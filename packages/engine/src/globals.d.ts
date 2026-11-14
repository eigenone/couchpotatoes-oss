// Available in every runtime the engine targets (Node 17+, all modern browsers),
// but only declared in the DOM lib. Declared here so the engine stays DOM-free.
declare function structuredClone<T>(value: T): T
