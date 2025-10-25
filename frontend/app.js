
const socketClient = io("ws://localhost:8080");
const dependencyMap = new WeakMap();
const componentRegistry = new Map();
const globalStore = reactive({
  appName: "JSS App",
  user: "Guest"
});

// --- Core Reactivity System ---
function reactive(initialValue) {
  const createProxy = (value) => {
    if (typeof value !== "object" || value === null) return value;
    if (dependencyMap.has(value)) return dependencyMap.get(value);

    const deps = new Map();
    const proxy = new Proxy(value, {
      get(target, prop) {
        return Reflect.get(target, prop);
      },
      set(target, prop, value) {
        const oldValue = Reflect.get(target, prop);
        if (oldValue !== value) {
            const success = Reflect.set(target, prop, value);
            if (success) {
              const dep = deps.get(prop);
              if(dep) dep.forEach((fn) => fn());
            }
            return success;
        }
        return true;
      },
    });
    dependencyMap.set(proxy, deps);
    return proxy;
  };
  return createProxy(initialValue);
}

function watch(obj, key, callback) {
    const deps = dependencyMap.get(obj);
    if (!deps) return;
    if (!deps.has(key)) deps.set(key, []);
    deps.get(key).push(callback);
}

// --- Scoped & Global CSS ---
function scopeCSS(css, scopeId) {
  const scopedStyle = css.replace(/([\s\S]+?){/g, (match, selector) => {
    const scopedSelector = selector
      .trim()
      .split(",")
      .map(s => `[${scopeId}] ${s.trim()}`)
      .join(", ");
    return `${scopedSelector} {`;
  });
  const styleTag = document.createElement("style");
  styleTag.setAttribute("data-v-jss", "");
  styleTag.setAttribute(scopeId, "");
  styleTag.textContent = scopedStyle;
  document.head.appendChild(styleTag);
}

function applyGlobalStyles(fileContent) {
  const globalContent = fileContent.replace(/<html[^>]*>[\s\S]*?<\/html>/g, '');
  const cssRegex = /<css>([\s\S]*?)<\/css>/g;
  let match;
  while ((match = cssRegex.exec(globalContent)) !== null) {
    if (match[1].trim()) {
        const styleTag = document.createElement('style');
        styleTag.textContent = match[1].trim();
        document.head.appendChild(styleTag);
    }
  }
}

// --- Script Execution Engines ---
function executeGlobalScript(scriptContent, context) {
    if (!scriptContent) return;
    try {
        const scriptFn = new Function('context', `with(context) { ${scriptContent} }`);
        scriptFn(context);
    } catch (e) {
        console.error("Error executing global script:", e, { scriptContent });
    }
}

function executeComponentScript(scriptContent) {
    if (!scriptContent) return { data: {}, methods: {} };
    const objectLiteralMatch = scriptContent.match(/^\s*\(\s*({[\s\S]+})\s*\)\s*$/);
    if (objectLiteralMatch) {
        try {
            const scriptFn = new Function(`return ${objectLiteralMatch[1]}`);
            const result = scriptFn();
            return { data: result.data || {}, methods: result.methods || {} };
        } catch (e) {
            console.error("Error parsing component script:", e, { scriptContent });
        }
    } else {
        console.warn("Component script is not in the expected `({ data: {}, methods: {} })` format.", { scriptContent });
    }
    return { data: {}, methods: {} };
}

// --- Template Parsing with Conditional Rendering ---
async function parseTemplate(template, state, methods) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = template;

  const evaluateIfCondition = (expression, context) => {
    try {
        const func = new Function(...Object.keys(context), `return ${expression};`);
        return func(...Object.values(context));
    } catch (e) {
        console.error(`Error evaluating data-if expression: "${expression}"`, e);
        return false;
    }
  };

  const processNode = (node) => {
    if (node.nodeType === 1 && node.hasAttribute('data-if')) {
      const expression = node.getAttribute('data-if');
      if (!evaluateIfCondition(expression, state)) {
        node.remove();
        return;
      }
      node.removeAttribute('data-if');
    }

    if (node.nodeType === 3) {
      node.textContent = node.textContent.replace(/\{\{\s*(.*?)\s*\}\}/g, (match, key) => {
        const keyTrim = key.trim();
        return keyTrim.split('.').reduce((acc, part) => acc ? acc[part] : undefined, state) ?? match;
      });
    }

    if (node.nodeType !== 1) return;

    for (const attr of [...node.attributes]) {
        if (attr.name.startsWith('data-event-')) {
            const eventType = attr.value;
            const methodName = attr.name.substring('data-event-'.length);
            if (methods && typeof methods[methodName] === 'function') {
                node.addEventListener(eventType, methods[methodName].bind(state));
            } else {
                console.warn(`Method "${methodName}" not found for event "${eventType}"`);
            }
            node.removeAttribute(attr.name);
        }
    }

    const childNodes = [...node.childNodes];
    for (let i = childNodes.length - 1; i >= 0; i--) {
      processNode(childNodes[i]);
    }
  };

  const childNodes = [...tempDiv.childNodes];
  for (let i = childNodes.length - 1; i >= 0; i--) {
    processNode(childNodes[i]);
  }

  return tempDiv.childNodes;
}

// --- Component System ---
async function createComponent(options) {
  const { template, data, methods, scopeId } = options;
  const boundMethods = {};
  for (const key in methods) {
    if (Object.prototype.hasOwnProperty.call(methods, key)) {
      boundMethods[key] = methods[key].bind(data);
    }
  }

  const componentRoot = document.createElement('div');
  componentRoot.setAttribute(scopeId, '');

  const updateDOM = async () => {
    const newContent = await parseTemplate(template, data, boundMethods);
    while (componentRoot.firstChild) {
      componentRoot.removeChild(componentRoot.firstChild);
    }
    const fragment = document.createDocumentFragment();
    newContent.forEach(node => fragment.appendChild(node.cloneNode(true)));
    componentRoot.appendChild(fragment);
  };

  Object.keys(data).forEach(key => {
    watch(data, key, updateDOM);
  });
  if (data.global) {
    Object.keys(data.global).forEach(key => {
      watch(data.global, key, updateDOM);
    });
  }

  await updateDOM();
  return componentRoot;
}

// --- Main Processing and Registration ---
async function preprocessAndRegisterComponents(fileContent) {
  const oldStyles = document.querySelectorAll('style[data-v-jss]');
  oldStyles.forEach(s => s.remove());
  componentRegistry.clear();

  const globalContent = fileContent.replace(/<html[^>]*>[\s\S]*?<\/html>/g, '');
  applyGlobalStyles(globalContent);
  const globalScript = globalContent.replace(/[<]css>([\s\S]*?)[<]\/css>/g, '').trim();
  executeGlobalScript(globalScript, globalStore);

  const componentRegex = /<html\s+name="([\w-]+)">([\s\S]*?)<\/html>/g;
  let match;
  while ((match = componentRegex.exec(fileContent)) !== null) {
    const [_, name, content] = match;
    const scriptRegex = /<script>([\s\S]*?)<\/script>/;
    const cssRegex = /<css>([\s\S]*?)<\/css>/;

    const scriptMatch = content.match(scriptRegex);
    const cssMatch = content.match(cssRegex);

    const { data: rawData, methods } = scriptMatch ? executeComponentScript(scriptMatch[1].trim()) : { data: {}, methods: {} };
    const reactiveState = reactive({ ...rawData, global: globalStore });

    const template = content.replace(scriptRegex, '').replace(cssRegex, '').trim();
    const scopeId = `data-v-${name}`;

    if (cssMatch && cssMatch[1].trim()) {
        scopeCSS(cssMatch[1].trim(), scopeId);
    }

    componentRegistry.set(name, { template, data: reactiveState, methods, scopeId });
  }

  document.body.innerHTML = '';
  const mainAppComponent = document.createElement('main-app');
  document.body.appendChild(mainAppComponent);

  for (const [name, options] of componentRegistry.entries()) {
      const elements = document.querySelectorAll(name);
      for (const element of elements) {
          const componentElement = await createComponent(options);
          element.replaceWith(componentElement);
      }
  }
}

// --- Socket.IO Hot Reloading ---
socketClient.on("components-updated", (files) => {
  if (Array.isArray(files)) {
    const combinedCode = files.join("\n");
    preprocessAndRegisterComponents(combinedCode);
  }
});
