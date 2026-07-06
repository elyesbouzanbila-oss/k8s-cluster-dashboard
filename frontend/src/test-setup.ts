import '@testing-library/jest-dom'

// jsdom doesn't implement scrollIntoView — polyfill for components that use it
if (typeof globalThis !== 'undefined' && !globalThis.Element.prototype.scrollIntoView) {
  globalThis.Element.prototype.scrollIntoView = () => {}
}
