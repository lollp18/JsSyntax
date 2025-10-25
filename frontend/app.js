
// =================================================================================================
// JSS-FRAMEWORK - EIN MINIMALISTISCHES, REAKTIVES FRONTEND-FRAMEWORK
// =================================================================================================
// Dieses Skript ist das Herzstück des JSS-Frameworks. Es ist verantwortlich für die Reaktivität,
// das Rendern von Komponenten, die Verarbeitung von Events und die Kommunikation mit dem Server.
// =================================================================================================

// -------------------------------------------------------------------------------------------------
// I. INITIALISIERUNG & GLOBALE ZUSTÄNDE
// -------------------------------------------------------------------------------------------------
// Hier werden die grundlegenden Bausteine der Anwendung initialisiert.
// - `socketClient`: Stellt die Verbindung zum Backend für Hot-Reloading her.
// - `componentRegistry`: Eine Map, die alle registrierten Komponenten-Definitionen speichert.
// - `dependencyMap`: Eine WeakMap, die für das Reaktivitäts-System benötigt wird, um Abhängigkeiten zu verfolgen.
// - `globalStore`: Ein reaktives Objekt, das anwendungsweite Zustände speichert (z.B. den App-Namen).
// -------------------------------------------------------------------------------------------------

const socketClient = io("ws://localhost:8080");
const componentRegistry = new Map();
const dependencyMap = new WeakMap();
const globalStore = reactive({
  appName: "JSS App",
  user: "Guest"
});

// -------------------------------------------------------------------------------------------------
// II. UPDATE-KOORDINATOR (ASYNCHRONES DOM-UPDATING)
// -------------------------------------------------------------------------------------------------
// Dies ist einer der wichtigsten Teile des Frameworks. Er verhindert "Race Conditions"
// beim Aktualisieren des DOMs, indem er alle Update-Anfragen in eine Warteschlange stellt
// und sie gebündelt und in der richtigen Reihenfolge ausführt.
// - `updateQueue`: Ein Set, das alle ausstehenden DOM-Update-Funktionen sammelt. Ein Set verhindert Duplikate.
// - `queueUpdate`: Fügt eine Update-Funktion zur Warteschlange hinzu und stößt die Abarbeitung an.
// - `flushUpdateQueue`: Führt alle gesammelten Updates asynchron aus.
// -------------------------------------------------------------------------------------------------

const updateQueue = new Set();
let isFlushing = false;

function queueUpdate(update) {
    if (!updateQueue.has(update)) {
        updateQueue.add(update);
        if (!isFlushing) {
            isFlushing = true;
            // Führt die Abarbeitung aus, sobald der aktuelle JavaScript-Call-Stack leer ist.
            Promise.resolve().then(flushUpdateQueue);
        }
    }
}

async function flushUpdateQueue() {
    try {
        for (const update of updateQueue) {
            // Wir warten auf jedes Update, um sicherzustellen, dass die Reihenfolge korrekt ist.
            await update();
        }
    } finally {
        updateQueue.clear();
        isFlushing = false;
    }
}

// -------------------------------------------------------------------------------------------------
// III. REAKTIVITÄTS-SYSTEM
// -------------------------------------------------------------------------------------------------
// Dieses System macht aus einfachen JavaScript-Objekten "reaktive" Objekte.
// Wenn sich eine Eigenschaft eines reaktiven Objekts ändert, wird automatisch
// eine Funktion (z.B. eine DOM-Aktualisierung) ausgelöst.
// - `reactive`: Nimmt ein Objekt und gibt einen Proxy zurück, der Änderungen überwacht.
// - `watch`: Registriert eine Callback-Funktion, die bei Änderung einer bestimmten Eigenschaft aufgerufen wird.
// - `deepWatch`: Überwacht rekursiv alle Eigenschaften eines Objekts und seiner Unter-Objekte.
// -------------------------------------------------------------------------------------------------

function reactive(obj) {
  if (obj === null || typeof obj !== 'object' || dependencyMap.has(obj)) {
    return obj;
  }
  const deps = new Map();
  // Macht alle Unter-Objekte ebenfalls reaktiv.
  Object.keys(obj).forEach(key => {
    obj[key] = reactive(obj[key]);
  });
  // Der Proxy fängt `set`-Operationen ab.
  const proxy = new Proxy(obj, {
    get: Reflect.get,
    set(target, key, value) {
      const oldValue = Reflect.get(target, key);
      if (oldValue !== value) {
        const success = Reflect.set(target, key, reactive(value));
        if (success) {
          // Löst alle registrierten Callbacks für diese Eigenschaft aus.
          const dep = deps.get(key);
          if (dep) dep.forEach(fn => fn());
        }
        return success;
      }
      return true;
    }
  });
  dependencyMap.set(proxy, deps);
  return proxy;
}

function watch(obj, key, callback) {
  if (!obj || typeof obj !== 'object' || !dependencyMap.has(obj)) return;
  const deps = dependencyMap.get(obj);
  if (!deps) return;
  if (!deps.has(key)) deps.set(key, []);
  deps.get(key).push(callback);
}

function deepWatch(obj, callback) {
    const visited = new Set();
    function traverse(currentObj) {
        if (!currentObj || typeof currentObj !== 'object' || visited.has(currentObj) || !dependencyMap.has(currentObj)) {
            return;
        }
        visited.add(currentObj);
        Object.keys(currentObj).forEach(key => {
            // Bei Änderung wird das Update in die Warteschlange gestellt.
            watch(currentObj, key, () => queueUpdate(callback));
            traverse(currentObj[key]); // Rekursiver Abstieg
        });
    }
    traverse(obj);
}


// -------------------------------------------------------------------------------------------------
// IV. LOW-CODE AKTIONS-HANDLER (`data-action`)
// -------------------------------------------------------------------------------------------------
// Definiert eine Reihe von einfachen, wiederverwendbaren Aktionen, die direkt
// aus dem HTML aufgerufen werden können, ohne dass man JavaScript schreiben muss.
// Beispiel: `data-action:click="increment(user.age)"`
// -------------------------------------------------------------------------------------------------

const actionHandlers = {
  increment(obj, key) {
    if (typeof obj[key] === 'number') obj[key]++;
  },
  decrement(obj, key) {
    if (typeof obj[key] === 'number') obj[key]--;
  },
  toggle(obj, key) {
    obj[key] = !obj[key];
  }
};

// -------------------------------------------------------------------------------------------------
// V. SKRIPT- & TEMPLATE-VERARBEITUNG
// -------------------------------------------------------------------------------------------------
// Diese Funktionen sind dafür zuständig, den Inhalt der `.jss`-Dateien zu parsen,
// also die `<script>`, `<css>` und `<div>`-Teile zu extrahieren und zu verarbeiten.
// - `executeComponentScript`: Liest den <script>-Block sicher aus und gibt immer ein valides Objekt zurück.
// - `evaluateExpression`: Wertet einen JavaScript-Ausdruck im Kontext eines Daten-Objekts sicher aus.
// - `parseTemplate`: Geht durch das HTML-Template und ersetzt Platzhalter `{{...}}` und bindet Events.
// -------------------------------------------------------------------------------------------------

function executeComponentScript(scriptContent) {
    const defaults = { props: [], data: {}, methods: {} };
    if (!scriptContent) {
        return defaults;
    }
    const match = scriptContent.match(/^\s*\(\s*({[\s\S]+})\s*\)\s*$/);
    if (match) {
        try {
            // Führt den Code im <script>-Block sicher aus und holt das Ergebnis.
            const result = new Function(`return ${match[1]}`)();
            return { ...defaults, ...result };
        } catch (e) {
            console.error("Fehler beim Parsen des Komponenten-Skripts:", e, { scriptContent });
            return defaults;
        }
    }
    return defaults;
}

function evaluateExpression(expression, context) {
  try {
    // Erstellt dynamisch eine Funktion, um den Ausdruck sicher auszuwerten.
    return new Function(...Object.keys(context), `return ${expression};`)(...Object.values(context));
  } catch (e) { 
    // Wenn der Ausdruck fehlschlägt (z.B. weil Daten noch nicht da sind), wird undefined zurückgegeben.
    return undefined; 
  }
}

async function parseTemplate(template, state, methods) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = template;
  
  const processNode = (node) => {
    // 1. Element-Knoten (z.B. <div>, <button>)
    if (node.nodeType === 1) {
      // `data-if`: Bedingtes Rendern. Wenn die Bedingung `false` ist, wird das Element entfernt.
      if (node.hasAttribute('data-if') && !evaluateExpression(node.getAttribute('data-if'), state)) {
        node.remove();
        return;
      }
      
      // Verarbeitet alle Attribute eines Elements.
      for (const attr of [...node.attributes]) {
        // `data-action:*`: Bindet Low-Code-Aktionen.
        if (attr.name.startsWith('data-action:')) {
          const eventType = attr.name.substring(12);
          const match = attr.value.match(/(\w+)\(([^)]*)\)/);
          if (match) {
            const [, handlerName, argPath] = match;
            const handler = actionHandlers[handlerName];
            if (handler) {
              node.addEventListener(eventType, () => {
                const keys = argPath.trim().split('.');
                const lastKey = keys.pop();
                const targetObject = keys.length > 0 ? evaluateExpression(keys.join('.'), state) : state;
                if (targetObject) handler(targetObject, lastKey);
              });
            }
          }
        // `data-event-*`: Bindet Methoden aus dem `<script>`-Block.
        } else if (attr.name.startsWith('data-event-')) {
            const eventType = attr.value;
            const methodName = attr.name.substring(11);
            if (methods?.[methodName]) {
                node.addEventListener(eventType, methods[methodName]);
            }
        }
      }
    }
    // 2. Text-Knoten (z.B. "Hallo {{ user.name }}")
    if (node.nodeType === 3) {
      // Ersetzt `{{...}}`-Platzhalter mit den Werten aus dem `state`.
      node.textContent = node.textContent.replace(/\{\{\s*(.*?)\s*\}\}/g, (m, key) => evaluateExpression(key.trim(), state) ?? m);
    }
    // Geht rekursiv durch alle Kind-Elemente.
    [...node.childNodes].forEach(processNode);
  };
  
  [...tempDiv.childNodes].forEach(processNode);
  return tempDiv.childNodes;
}

// -------------------------------------------------------------------------------------------------
// VI. KOMPONENTEN-SYSTEM
// -------------------------------------------------------------------------------------------------
// Dieses System ist verantwortlich für das Erstellen, Verwalten und Rendern der Komponenten.
// - `createComponent`: Erstellt eine Instanz einer Komponente, initialisiert ihren Zustand,
//   bindet Props und Methoden und richtet die Reaktivität ein.
// - `renderComponents`: Sucht nach benutzerdefinierten Tags (z.B. `<user-card>`) im DOM
//   und ersetzt sie durch die gerenderten Komponenten-Instanzen.
// -------------------------------------------------------------------------------------------------

async function createComponent(name, parentElement, parentState) {
  const componentOptions = componentRegistry.get(name);
  if (!componentOptions) return null;

  const { template, props: declaredProps, data, methods, scopeId } = componentOptions;
  // Jede Komponente hat ihren eigenen reaktiven Zustand.
  const reactiveState = reactive({ ...data, global: globalStore });

  // Verarbeitet `props` (Eigenschaften), die von einer Eltern-Komponente übergeben werden.
  for (const propName of declaredProps) {
      const dynamicAttr = parentElement.getAttribute(`:${propName}`) || parentElement.getAttribute(`v-bind:${propName}`);
      if (dynamicAttr) {
          // Dynamische Prop (z.B. `:userage="user1.age"`)
          reactiveState[propName] = evaluateExpression(dynamicAttr, parentState);
          // Richte eine Überwachung ein, damit die Prop sich aktualisiert, wenn die Elterndaten sich ändern.
          deepWatch(parentState, () => {
              reactiveState[propName] = evaluateExpression(dynamicAttr, parentState);
          });
      } else {
          // Statische Prop (z.B. `username="Alice"`)
          reactiveState[propName] = parentElement.getAttribute(propName);
      }
  }

  // Bindet die `this`-Referenz in den Methoden an den reaktiven Zustand der Komponente.
  const boundMethods = Object.entries(methods || {}).reduce((acc, [key, fn]) => ({ ...acc, [key]: fn.bind(reactiveState) }), {});
  
  const componentRoot = document.createElement('div');
  componentRoot.setAttribute(scopeId, ''); // Für gekapseltes CSS.

  // Die Hauptfunktion, die das DOM der Komponente neu zeichnet.
  const updateDOM = async () => {
    const newContent = await parseTemplate(template, reactiveState, boundMethods);
    componentRoot.innerHTML = ''; 
    const fragment = document.createDocumentFragment();
    newContent.forEach(node => fragment.appendChild(node.cloneNode(true)));
    componentRoot.appendChild(fragment);
    // Rendert rekursiv eventuelle Kind-Komponenten innerhalb dieser Komponente.
    await renderComponents(componentRoot, reactiveState); 
  };

  // Richte die Reaktivität ein. Bei jeder Datenänderung wird `updateDOM` in die Warteschlange gestellt.
  deepWatch(reactiveState, updateDOM);
  // Führe das erste Rendern aus.
  queueUpdate(updateDOM);

  return componentRoot;
}

async function renderComponents(rootElement, parentState) {
    for (const name of componentRegistry.keys()) {
        const elements = rootElement.querySelectorAll(name);
        for (const element of elements) {
            // Verhindert, dass Komponenten innerhalb ihrer selbst endlos neu gerendert werden.
            if (element.closest('[data-v-jss]')) continue;
            const componentElement = await createComponent(name, element, parentState);
            if (componentElement) {
                element.replaceWith(componentElement);
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------
// VII. CSS-MANAGEMENT
// -------------------------------------------------------------------------------------------------
// Diese Funktionen verwalten die Stile.
// - `scopeCSS`: Nimmt CSS aus einem `<css>`-Block und macht es "scoped", d.h. es gilt nur
//   für die jeweilige Komponente, indem es ein eindeutiges Attribut hinzufügt (z.B. `[data-v-main-app] p`).
// - `applyGlobalStyles`: Fügt CSS, das außerhalb von `<html>`-Tags definiert ist, global zur Seite hinzu.
// -------------------------------------------------------------------------------------------------

function scopeCSS(css, scopeId) {
  const scopedStyle = css.replace(/([\s\S]+?){/g, (match, selector) => 
    `${selector.trim().split(",").map(s => `[${scopeId}] ${s.trim()}`).join(", ")} {`
  );
  const styleTag = document.createElement("style");
  styleTag.setAttribute("data-v-jss", ""); // Markierung für JSS-Stile
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

// -------------------------------------------------------------------------------------------------
// VIII. HAUPTPROZESS & HOT-RELOADING
// -------------------------------------------------------------------------------------------------
// Dies ist der Startpunkt der Anwendung.
// - `preprocessAndRegisterComponents`: Verarbeitet den gesamten Inhalt der `.jss`-Dateien,
//   registriert die Komponenten und startet den ersten Render-Vorgang.
// - `socketClient.on('components-updated', ...)`: Horcht auf Nachrichten vom Server.
//   Wenn sich eine `.jss`-Datei ändert, wird der gesamte Prozess neu angestoßen (Hot Reloading).
// -------------------------------------------------------------------------------------------------

async function preprocessAndRegisterComponents(fileContent) {
    // Setzt den Zustand zurück für ein sauberes Hot-Reload.
    document.body.innerHTML = '';
    componentRegistry.clear();
    document.querySelectorAll('style[data-v-jss]').forEach(s => s.remove());

    const globalContent = fileContent.replace(/<html[^>]*>[\s\S]*?<\/html>/g, '');
    applyGlobalStyles(globalContent);
    // Führt globale Skripte aus
    const globalScript = globalContent.replace(/<css>([\s\S]*?)<\/css>/g, '').trim();
    if (globalScript) {
        try {
            new Function('context', `with(context) { ${globalScript} }`)(globalStore);
        } catch (e) {
            console.error("Fehler im globalen Skript:", e);
        }
    }

    // Findet alle Komponenten (`<html name="...">`) in den Dateien.
    for (const match of fileContent.matchAll(/<html\s+name="([\w-]+)">([\s\S]*?)<\/html>/g)) {
        const [_, name, content] = match;
        const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
        const cssMatch = content.match(/<css>([\s\S]*?)<\/css>/);
        
        // Extrahiert sicher die Komponenten-Definition.
        const componentDefinition = executeComponentScript(scriptMatch ? scriptMatch[1].trim() : null);
        const { props, data, methods } = componentDefinition;
        
        const template = content.replace(/<script>[\s\S]*?<\/script>|(<css>[\s\S]*?<\/css>)/g, '').trim();
        const scopeId = `data-v-${name}`;
        if (cssMatch?.[1].trim()) {
            scopeCSS(cssMatch[1].trim(), scopeId);
        }

        // Registriert die Komponente für die spätere Verwendung.
        componentRegistry.set(name, { template, props, data, methods, scopeId });
    }
    
    // Erstellt das Wurzel-Element der Haupt-App und startet das Rendern.
    const mainAppElement = document.createElement('main-app');
    document.body.appendChild(mainAppElement);
    await renderComponents(document.body, globalStore);
}

socketClient.on("connect", () => console.log("JSS-Framework: Bereit und verbunden."));
socketClient.on("components-updated", (files) => {
  if (Array.isArray(files)) {
    console.log("JSS-Framework: Änderungen erkannt, lade Komponenten neu...");
    preprocessAndRegisterComponents(files.join("\n"));
  }
});
