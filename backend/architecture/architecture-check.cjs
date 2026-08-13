const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(backendRoot, 'src');
const baselinePath = path.join(__dirname, 'architecture-baseline.json');

function listTypeScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(filePath);
    return entry.name.endsWith('.ts') ? [filePath] : [];
  });
}

function moduleName(filePath) {
  const modulesRoot = path.join(sourceRoot, 'modules');
  const commonRoot = path.join(sourceRoot, 'common');
  const relativeToModules = path.relative(modulesRoot, filePath);
  const relativeToCommon = path.relative(commonRoot, filePath);
  if (!relativeToModules.startsWith(`..${path.sep}`) && relativeToModules !== '..') {
    return relativeToModules.split(path.sep)[0];
  }
  if (!relativeToCommon.startsWith(`..${path.sep}`) && relativeToCommon !== '..') return 'common';
  return 'outside-src';
}

function resolveImport(sourceFile, importPath) {
  if (!importPath.startsWith('.')) return null;

  const basePath = path.resolve(path.dirname(sourceFile), importPath);
  const candidates = [basePath, `${basePath}.ts`, path.join(basePath, 'index.ts')];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function parseImports(sourceFile) {
  const source = fs.readFileSync(sourceFile, 'utf8');
  const imports = [];
  const importPattern =
    /(^|[;\n])\s*import\s+(type\s+)?[^;\n]*?\sfrom\s+(['"])([^'"]+)\3|(^|[;\n])\s*import\s*\(\s*(['"])([^'"]+)\6/gm;
  let match;
  while ((match = importPattern.exec(source)) !== null) {
    if (match[2]) continue;
    const importPath = match[7] ?? match[4];
    const target = resolveImport(sourceFile, importPath);
    if (target) imports.push(target);
  }
  return imports;
}

function buildGraph(files) {
  const moduleFiles = files.filter((file) => {
    const name = moduleName(file);
    return name !== 'common' && name !== 'outside-src' && file.endsWith('.module.ts');
  });
  const graph = new Map([...new Set(moduleFiles.map(moduleName))].map((name) => [name, new Set()]));
  for (const file of moduleFiles) {
    const sourceModule = moduleName(file);
    for (const importedFile of parseImports(file)) {
      if (!importedFile.endsWith('.module.ts')) continue;
      const targetModule = moduleName(importedFile);
      if (targetModule !== sourceModule && graph.has(targetModule)) {
        graph.get(sourceModule).add(targetModule);
      }
    }
  }
  return graph;
}

function findCycles(graph) {
  let index = 0;
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  function visit(node) {
    indices.set(node, index);
    lowLinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const dependency of graph.get(node) ?? []) {
      if (!indices.has(dependency)) {
        visit(dependency);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(dependency)));
      } else if (onStack.has(dependency)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(dependency)));
      }
    }

    if (lowLinks.get(node) === indices.get(node)) {
      const component = [];
      let current;
      do {
        current = stack.pop();
        onStack.delete(current);
        component.push(current);
      } while (current !== node);
      if (component.length > 1) components.push(component.sort().join('<->'));
    }
  }

  for (const node of graph.keys()) {
    if (!indices.has(node)) visit(node);
  }
  return components.sort();
}

function findViolations() {
  const files = listTypeScriptFiles(sourceRoot);
  const graph = buildGraph(files);
  const violations = findCycles(graph).map((cycle) => `cycle:${cycle}`);

  for (const file of files) {
    const sourceModule = moduleName(file);
    if (sourceModule !== 'common') continue;
    for (const importedFile of parseImports(file)) {
      if (moduleName(importedFile) !== 'common' && moduleName(importedFile) !== 'outside-src') {
        violations.push(
          `common-reverse-dependency:${path.relative(sourceRoot, file)}->${moduleName(importedFile)}`,
        );
      }
    }
  }

  return [...new Set(violations)].sort();
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return [];
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8')).violations ?? [];
}

function writeBaseline(violations) {
  fs.writeFileSync(baselinePath, `${JSON.stringify({ violations }, null, 2)}\n`);
}

function main() {
  const violations = findViolations();
  if (process.argv.includes('--update-baseline')) {
    writeBaseline(violations);
    console.log(`Architecture baseline updated: ${violations.length} violation(s)`);
    return;
  }

  const baseline = new Set(readBaseline());
  const newViolations = violations.filter((violation) => !baseline.has(violation));
  console.log(
    `Architecture fitness check: ${violations.length} detected, ${newViolations.length} new`,
  );
  if (newViolations.length > 0) {
    console.error(newViolations.map((violation) => `- ${violation}`).join('\n'));
    process.exitCode = 1;
  }
}

module.exports = { buildGraph, findCycles, findViolations };

if (require.main === module) main();
