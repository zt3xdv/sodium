const components = {};

export function registerComponent(name, component) {
  components[name] = component;
}

export function render(name, props = {}) {
  const component = components[name];
  if (!component) {
    console.warn(`Component "${name}" not found`);
    return '';
  }
  return component(props);
}

export function getComponent(name) {
  return components[name];
}
