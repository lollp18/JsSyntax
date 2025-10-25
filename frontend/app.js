import { io } from "socket.io-client"

const socketClient = io("ws://localhost:8080")
const dependencyMap = new WeakMap()
const componentRegistry = new Map()
const globalReactiveVariables = {}

/** Reaktive Variablen */
function reactive(initialValue) {
  const createProxy = (value) => {
    if (typeof value !== "object" || value === null) return value
    if (dependencyMap.has(value)) return dependencyMap.get(value)

    const deps = new Map()
    const proxy = new Proxy(value, {
      get(target, prop) {
        const result = Reflect.get(target, prop)
        return typeof result === "object" ? createProxy(result) : result
      },
      set(target, prop, value) {
        const success = Reflect.set(target, prop, value)
        if (success) (deps.get(prop) || []).forEach((fn) => fn())
        return success
      },
    })
    dependencyMap.set(value, proxy)
    return proxy
  }
  return createProxy(initialValue)
}

/** Lifecycle-Hook */
function callLifecycleHook(hook, options, state, component) {
  if (typeof options[hook] === "function") options[hook].call(state, component)
}

/** Template-Parsing */
async function parseTemplate(template, state, methods, props, slots) {
  const fragment = document.createDocumentFragment()
  const domParser = new DOMParser()
  const doc = domParser.parseFromString(template, "text/html")

  for (const node of [...doc.body.childNodes]) {
    if (node.nodeType === 1) {
      if (node.hasAttribute("v-if")) {
        if (
          !new Function(
            ...Object.keys(state),
            `return ${node.getAttribute("v-if")}`
          )(...Object.values(state))
        )
          continue
        node.removeAttribute("v-if")
      }
      if (node.hasAttribute("v-for")) {
        const [item, list] = node
          .getAttribute("v-for")
          .split(" in ")
          .map((s) => s.trim())
        for (const value of state[list]) {
          const clone = node.cloneNode(true)
          state[item] = value
          fragment.appendChild(
            await parseTemplate(clone.outerHTML, state, methods, props, slots)
          )
        }
        continue
      }
      if (node.tagName === "SLOT") {
        const slotName = node.getAttribute("name") || "default"
        const slotContent = slots[slotName]
        if (slotContent) {
          const slotHTML =
            typeof slotContent === "function"
              ? await slotContent(state, props)
              : slotContent
          fragment.appendChild(
            await parseTemplate(slotHTML, state, methods, props, slots)
          )
        }
        continue
      }
    }
    fragment.appendChild(node)
  }
  return fragment
}

/** Komponentensystem */
async function createComponent(options, props = {}, slots = {}) {
  const {
    template,
    data,
    methods,
    props: propDefs,
    beforeMount,
    mounted,
    updated,
  } = options
  const state = reactive(data || {})
  callLifecycleHook("beforeMount", options, state)

  const render = async () => {
    const container = document.createElement("div")
    const content = await parseTemplate(
      template,
      state,
      methods || {},
      props,
      slots
    )
    container.appendChild(content)
    return container.firstElementChild
  }

  const component = await render()
  Object.keys(state).forEach((key) => {
    const originalValue = state[key]
    watch(state, key, async () => {
      const newComponent = await render()
      component.replaceWith(newComponent)
      Object.assign(component, newComponent)
      callLifecycleHook("updated", options, state, component)
    })
  })

  callLifecycleHook("mounted", options, state, component)
  return component
}

/** Globale Registrierung */
function registerComponent(name, options) {
  if (!name || componentRegistry.has(name))
    throw new Error(`Ungültiger oder doppelter Komponentenname: "${name}".`)
  componentRegistry.set(name, options)
}

/** Automatische Injektion */
function injectComponents() {
  componentRegistry.forEach(async (options, name) => {
    document.querySelectorAll(name).forEach(async (el) => {
      const props = {}([...el.attributes]).forEach(
        (attr) => (props[attr.name] = attr.value)
      )
      const slots = { default: el.innerHTML }
      const component = await createComponent(options, props, slots)
      el.replaceWith(component)
    })
  })
}

/** Beobachter */
function watch(obj, key, callback) {
  if (typeof obj !== "object") throw new Error("Nur Objekte sind beobachtbar.")
  const deps = dependencyMap.get(obj) || new Map()
  if (!deps.has(key)) deps.set(key, [])
  deps.get(key).push(callback)
  dependencyMap.set(obj, deps)
}
/** HTML-Dateien einlesen und verarbeiten */
function preprocessAndRegisterComponents(inputCode) {
  const globalVarRegex = /^([a-zA-Z_]\w*):\s*(.+);?$/
  const htmlTagRegex = /<html\s+name="([\w-]+)">([\s\S]*?)<\/html>/g

  inputCode.split("\n").forEach((line) => {
    const match = line.match(globalVarRegex)
    if (match) {
      const [_, varName, varValue] = match
      globalReactiveVariables[varName] = reactive(eval(varValue))
    }
  })

  let match
  while ((match = htmlTagRegex.exec(inputCode)) !== null) {
    const [_, name, template] = match
    registerComponent(name, { template, data: {}, methods: {} })
  }
  injectComponents()
}
console.log("hallo")
socketClient.on("components", (data) => {
  console.log(data)
})
