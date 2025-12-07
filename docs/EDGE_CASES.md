# Edge Cases and Handling

This document describes edge cases handled by Chunkyyy and how they're addressed.

## 1. Nested Functions

### Case
Functions defined inside other functions or classes.

```typescript
function outer() {
  function inner() {
    return 42;
  }
  return inner();
}
```

### Handling
- Inner functions are extracted as separate chunks
- `parentId` field links to parent chunk
- `childrenIds` field lists child chunks

## 2. Arrow Functions

### Case
Arrow functions can be:
- Assigned to variables: `const add = (a, b) => a + b`
- Inline: `array.map(x => x * 2)`
- Method definitions: `class C { method = () => {} }`

### Handling
- Variable-assigned arrow functions are extracted as function chunks
- Inline arrow functions are included in parent chunk
- Method arrow functions are extracted as method chunks

## 3. Decorators

### Case
Decorators applied to classes, methods, properties.

```typescript
@Component({
  selector: 'app-root'
})
export class AppComponent {
  @Input() title: string;

  @HostListener('click')
  onClick() {}
}
```

### Handling
- Decorators are extracted and stored in `decorators` array
- Decorator names are extracted (e.g., "Component", "Input")
- Full decorator expressions can be included

## 4. Function Overloads

### Case
Multiple function signatures with single implementation.

```typescript
function process(value: string): string;
function process(value: number): number;
function process(value: string | number): string | number {
  return value;
}
```

### Handling
- Implementation function is extracted
- Type information captures overload signatures
- Return types reflect union types

## 5. Generics (Type Parameters)

### Case
Functions, classes, interfaces with type parameters.

```typescript
function identity<T>(value: T): T {
  return value;
}

class Container<T> {
  value: T;
}
```

### Handling
- Type parameters stored in `typeParameters` array
- Generic constraints are preserved
- Used for better semantic matching

## 6. Async/Generator Functions

### Case
Async functions and generators.

```typescript
async function fetchData() {
  const response = await fetch('/api');
  return response.json();
}

function* generateNumbers() {
  yield 1;
  yield 2;
}

async function* asyncGenerator() {
  yield await fetch('/api');
}
```

### Handling
- `async` flag set for async functions
- `generator` flag set for generator functions
- Both flags can be true for async generators

## 7. Anonymous Functions

### Case
Functions without names.

```typescript
const handler = function() {
  return 42;
};

array.map(function(x) {
  return x * 2;
});
```

### Handling
- Variable-assigned anonymous functions use variable name
- Inline anonymous functions are skipped (too small/context-dependent)
- Can be configured to include/exclude

## 8. Export Variations

### Case
Different export styles.

```typescript
export function foo() {}
export { bar };
export default baz;
export * from './other';
```

### Handling
- Direct exports: `exported: true`, `exportName` set
- Named exports: Extracted from export declaration
- Default exports: `exportName: 'default'`
- Re-exports: Tracked in import/export map

## 9. Namespaces and Modules

### Case
TypeScript namespaces and ES modules.

```typescript
namespace MyNamespace {
  export function helper() {}
}

export module MyModule {
  export const value = 42;
}
```

### Handling
- Namespaces extracted as separate chunks
- Nested declarations linked via parent-child relationships
- Module declarations handled similarly

## 10. Type Aliases and Interfaces

### Case
Type definitions.

```typescript
type User = {
  id: number;
  name: string;
};

interface Admin extends User {
  role: string;
}
```

### Handling
- Type aliases extracted as chunks
- Interfaces extracted as chunks
- Inheritance/extensions tracked in metadata

## 11. Enums

### Case
Enum declarations.

```typescript
enum Status {
  Pending,
  Active,
  Inactive
}

const enum ConstEnum {
  Value = 1
}
```

### Handling
- Enums extracted as chunks
- Enum members included in content
- Const enums handled similarly

## 12. Class Methods and Properties

### Case
Various class members.

```typescript
class Example {
  private prop: string;
  public method() {}
  static staticMethod() {}
  get accessor() { return this.prop; }
  set accessor(value: string) { this.prop = value; }
}
```

### Handling
- Methods extracted as method chunks
- Properties included in class chunk
- Accessors extracted as methods
- Static methods marked (if detectable)
- Visibility modifiers extracted

## 13. JSDoc Comments

### Case
Documentation comments.

```typescript
/**
 * Calculates the sum of two numbers
 * @param a First number
 * @param b Second number
 * @returns Sum of a and b
 */
function add(a: number, b: number): number {
  return a + b;
}
```

### Handling
- JSDoc extracted and stored in `jsdoc` field
- Used for better semantic understanding
- Helps with retrieval quality

## 14. Import/Export Complexity

### Case
Complex import/export patterns.

```typescript
import defaultExport, { named1, named2 as alias } from 'module';
import * as namespace from 'module';
import('./dynamic-module').then(m => m.foo());
```

### Handling
- All import styles tracked
- Aliases preserved
- Namespace imports tracked
- Dynamic imports included
- Used for dependency graph

## 15. Large Files

### Case
Files with many declarations or very large functions.

### Handling
- Chunks respect size limits
- Large chunks can be split (AST-aware)
- Small chunks can be merged
- Configurable thresholds

## 16. Syntax Errors

### Case
Invalid TypeScript/JavaScript code.

### Handling
- Errors caught and logged
- Partial chunks returned if possible
- Error information included in result
- Continues processing other files

## 17. Circular Dependencies

### Case
Files that import each other.

```typescript
// file1.ts
import { B } from './file2';
export class A {}

// file2.ts
import { A } from './file1';
export class B {}
```

### Handling
- Dependency graph detects cycles
- Can be used to warn users
- Doesn't break chunking process

## 18. Conditional Exports

### Case
TypeScript conditional exports.

```typescript
export type { Type } from './types';
export { function } from './functions';
```

### Handling
- Re-exports tracked
- Original source tracked
- Used in import/export map

## Testing Edge Cases

All edge cases should be covered by tests in `src/__tests__/`. When adding new edge case handling, add corresponding tests.
