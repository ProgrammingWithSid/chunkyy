/**
 * Comprehensive Chunking Scenarios Test Suite
 *
 * This test suite defines various code patterns and their expected chunk outputs.
 * It compares actual chunking results with expected outputs to identify gaps
 * and areas for improvement in the chunking logic.
 */

import { Chunker } from '../core/chunker';
import { Chunk, ChunkType } from '../types';

interface TestScenario {
  name: string;
  description: string;
  code: string;
  filePath: string;
  expectedChunks: ExpectedChunk[];
  expectedCount?: number;
  expectedTypes?: ChunkType[];
  skip?: boolean; // Skip if known limitation
}

interface ExpectedChunk {
  type: ChunkType;
  name: string;
  qualifiedName?: string;
  exported?: boolean;
  exportName?: string; // For default exports
  startLine?: number;
  endLine?: number;
  hasContent?: boolean;
  hasDependencies?: boolean;
  parentName?: string; // For nested chunks
  childrenCount?: number; // For classes/interfaces
  async?: boolean;
  generator?: boolean;
  visibility?: 'public' | 'private' | 'protected';
  parametersCount?: number;
  returnType?: string;
}

describe('Comprehensive Chunking Scenarios', () => {
  let chunker: Chunker;

  beforeEach(() => {
    chunker = new Chunker({ parser: 'typescript', includeContent: true });
  });

  const scenarios: TestScenario[] = [
    // ========================================================================
    // BASIC FUNCTION SCENARIOS
    // ========================================================================
    {
      name: 'Simple exported function',
      description: 'Basic exported function with parameters',
      code: `
export function greet(name: string, age: number): string {
  return \`Hello, \${name}! You are \${age} years old.\`;
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'greet',
          qualifiedName: 'greet',
          exported: true,
          parametersCount: 2,
          returnType: 'string',
        },
      ],
    },
    {
      name: 'Arrow function export',
      description: 'Arrow function exported as const',
      code: `
export const multiply = (a: number, b: number): number => {
  return a * b;
};
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'multiply',
          qualifiedName: 'multiply',
          exported: true,
          parametersCount: 2,
          returnType: 'number',
        },
      ],
    },
    {
      name: 'Async function',
      description: 'Async function with await',
      code: `
export async function fetchUser(id: string): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'fetchUser',
          qualifiedName: 'fetchUser',
          exported: true,
          async: true,
          returnType: 'Promise<User>',
        },
      ],
    },
    {
      name: 'Generator function',
      description: 'Generator function with yield',
      code: `
export function* fibonacci(): Generator<number> {
  let a = 0, b = 1;
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'fibonacci',
          qualifiedName: 'fibonacci',
          exported: true,
          generator: true,
          returnType: 'Generator<number>',
        },
      ],
    },
    {
      name: 'Function with default parameters',
      description: 'Function with optional/default parameters',
      code: `
function createUser(name: string, age: number = 18, active: boolean = true): User {
  return { name, age, active };
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'createUser',
          qualifiedName: 'createUser',
          exported: false,
          parametersCount: 3,
        },
      ],
    },
    {
      name: 'Function with rest parameters',
      description: 'Function with rest/spread parameters',
      code: `
export function sum(...numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'sum',
          qualifiedName: 'sum',
          exported: true,
        },
      ],
    },
    {
      name: 'Function with overloads',
      description: 'Function with multiple overload signatures',
      code: `
function process(value: string): string;
function process(value: number): number;
function process(value: string | number): string | number {
  return value;
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'process',
          qualifiedName: 'process',
        },
      ],
    },
    {
      name: 'Nested function',
      description: 'Function defined inside another function',
      code: `
function outer() {
  function inner() {
    return 42;
  }
  return inner();
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'outer',
          qualifiedName: 'outer',
        },
        {
          type: 'function',
          name: 'inner',
          qualifiedName: 'outer.inner',
          parentName: 'outer',
        },
      ],
    },
    {
      name: 'IIFE (Immediately Invoked Function Expression)',
      description: 'Self-executing function',
      code: `
const result = (function() {
  return 'IIFE';
})();
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [], // IIFEs might not be extracted
    },
    {
      name: 'Function with JSDoc',
      description: 'Function with documentation comment',
      code: `
/**
 * Calculates the area of a circle
 * @param radius - The radius of the circle
 * @returns The area of the circle
 */
export function circleArea(radius: number): number {
  return Math.PI * radius * radius;
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'circleArea',
          qualifiedName: 'circleArea',
          exported: true,
        },
      ],
    },

    // ========================================================================
    // CLASS SCENARIOS
    // ========================================================================
    {
      name: 'Simple class with methods',
      description: 'Class with public methods',
      code: `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'class',
          name: 'Calculator',
          qualifiedName: 'Calculator',
          exported: true,
          childrenCount: 2,
        },
        {
          type: 'method',
          name: 'add',
          qualifiedName: 'Calculator.add',
          parentName: 'Calculator',
        },
        {
          type: 'method',
          name: 'subtract',
          qualifiedName: 'Calculator.subtract',
          parentName: 'Calculator',
        },
      ],
    },
    {
      name: 'Class with private methods',
      description: 'Class with visibility modifiers',
      code: `
export class BankAccount {
  private balance: number = 0;

  public deposit(amount: number): void {
    this.balance += amount;
  }

  private validateAmount(amount: number): boolean {
    return amount > 0;
  }
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'class',
          name: 'BankAccount',
          qualifiedName: 'BankAccount',
          exported: true,
          childrenCount: 2,
        },
        {
          type: 'method',
          name: 'deposit',
          qualifiedName: 'BankAccount.deposit',
          visibility: 'public',
        },
        {
          type: 'method',
          name: 'validateAmount',
          qualifiedName: 'BankAccount.validateAmount',
          visibility: 'private',
        },
      ],
    },
    {
      name: 'Class with constructor',
      description: 'Class with constructor method',
      code: `
export class Person {
  constructor(public name: string, private age: number) {}

  getAge(): number {
    return this.age;
  }
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'class',
          name: 'Person',
          qualifiedName: 'Person',
          exported: true,
          childrenCount: 2, // constructor + getAge
        },
        {
          type: 'method',
          name: 'constructor',
          qualifiedName: 'Person.constructor',
        },
        {
          type: 'method',
          name: 'getAge',
          qualifiedName: 'Person.getAge',
        },
      ],
    },
    {
      name: 'Class with static methods',
      description: 'Class with static members',
      code: `
export class MathUtils {
  static PI = 3.14159;

  static add(a: number, b: number): number {
    return a + b;
  }
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'class',
          name: 'MathUtils',
          qualifiedName: 'MathUtils',
          exported: true,
          childrenCount: 1, // static method
        },
        {
          type: 'method',
          name: 'add',
          qualifiedName: 'MathUtils.add',
        },
      ],
    },
    {
      name: 'Class with getters and setters',
      description: 'Class with accessor methods',
      code: `
export class Rectangle {
  private _width: number = 0;
  private _height: number = 0;

  get width(): number {
    return this._width;
  }

  set width(value: number) {
    this._width = value;
  }
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'class',
          name: 'Rectangle',
          qualifiedName: 'Rectangle',
          exported: true,
          childrenCount: 2, // getter + setter
        },
      ],
    },
    {
      name: 'Abstract class',
      description: 'Abstract class with abstract methods',
      code: `
export abstract class Animal {
  abstract makeSound(): void;

  move(): void {
    console.log('Moving...');
  }
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'class',
          name: 'Animal',
          qualifiedName: 'Animal',
          exported: true,
          childrenCount: 2,
        },
      ],
    },
    {
      name: 'Class with inheritance',
      description: 'Class extending another class',
      code: `
export class Dog extends Animal {
  makeSound(): void {
    console.log('Woof!');
  }
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'class',
          name: 'Dog',
          qualifiedName: 'Dog',
          exported: true,
          childrenCount: 1,
        },
      ],
    },
    {
      name: 'Class implementing interface',
      description: 'Class implementing an interface',
      code: `
export class UserService implements IUserService {
  getUser(id: string): User {
    return { id, name: 'John' };
  }
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'class',
          name: 'UserService',
          qualifiedName: 'UserService',
          exported: true,
        },
      ],
    },
    {
      name: 'Class with decorators',
      description: 'Class with decorator annotations',
      code: `
@Component({
  selector: 'app-user'
})
export class UserComponent {
  @Input() name: string = '';
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'class',
          name: 'UserComponent',
          qualifiedName: 'UserComponent',
          exported: true,
        },
      ],
    },
    {
      name: 'Nested class',
      description: 'Class defined inside another class',
      code: `
export class Outer {
  static Inner = class {
    method(): void {}
  };
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'class',
          name: 'Outer',
          qualifiedName: 'Outer',
          exported: true,
        },
      ],
    },

    // ========================================================================
    // INTERFACE SCENARIOS
    // ========================================================================
    {
      name: 'Simple interface',
      description: 'Basic interface definition',
      code: `
export interface User {
  id: number;
  name: string;
  email: string;
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'interface',
          name: 'User',
          qualifiedName: 'User',
          exported: true,
        },
      ],
    },
    {
      name: 'Interface with methods',
      description: 'Interface with method signatures',
      code: `
export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'interface',
          name: 'IRepository',
          qualifiedName: 'IRepository',
          exported: true,
        },
      ],
    },
    {
      name: 'Interface extending interface',
      description: 'Interface inheritance',
      code: `
export interface Animal {
  name: string;
}

export interface Dog extends Animal {
  breed: string;
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'interface',
          name: 'Animal',
          qualifiedName: 'Animal',
          exported: true,
        },
        {
          type: 'interface',
          name: 'Dog',
          qualifiedName: 'Dog',
          exported: true,
        },
      ],
    },
    {
      name: 'Interface with generics',
      description: 'Generic interface',
      code: `
export interface Container<T> {
  value: T;
  getValue(): T;
  setValue(value: T): void;
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'interface',
          name: 'Container',
          qualifiedName: 'Container',
          exported: true,
        },
      ],
    },
    {
      name: 'Interface with optional properties',
      description: 'Interface with optional members',
      code: `
export interface Config {
  required: string;
  optional?: number;
  readonly readOnly: boolean;
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'interface',
          name: 'Config',
          qualifiedName: 'Config',
          exported: true,
        },
      ],
    },

    // ========================================================================
    // ENUM SCENARIOS
    // ========================================================================
    {
      name: 'String enum',
      description: 'Enum with string values',
      code: `
export enum Status {
  Pending = 'pending',
  Active = 'active',
  Inactive = 'inactive'
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'enum',
          name: 'Status',
          qualifiedName: 'Status',
          exported: true,
        },
      ],
    },
    {
      name: 'Numeric enum',
      description: 'Enum with numeric values',
      code: `
export enum Direction {
  Up,
  Down,
  Left,
  Right
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'enum',
          name: 'Direction',
          qualifiedName: 'Direction',
          exported: true,
        },
      ],
    },
    {
      name: 'Const enum',
      description: 'Const enum for inlining',
      code: `
export const enum Colors {
  Red = '#FF0000',
  Green = '#00FF00',
  Blue = '#0000FF'
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'enum',
          name: 'Colors',
          qualifiedName: 'Colors',
          exported: true,
        },
      ],
    },

    // ========================================================================
    // TYPE ALIAS SCENARIOS
    // ========================================================================
    {
      name: 'Type alias',
      description: 'Type alias definition',
      code: `
export type UserId = string;
export type UserMap = Map<string, User>;
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'type-alias',
          name: 'UserId',
          qualifiedName: 'UserId',
          exported: true,
        },
        {
          type: 'type-alias',
          name: 'UserMap',
          qualifiedName: 'UserMap',
          exported: true,
        },
      ],
    },
    {
      name: 'Union type alias',
      description: 'Union type definition',
      code: `
export type Status = 'pending' | 'active' | 'inactive';
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'type-alias',
          name: 'Status',
          qualifiedName: 'Status',
          exported: true,
        },
      ],
    },
    {
      name: 'Intersection type alias',
      description: 'Intersection type definition',
      code: `
export type UserWithRole = User & { role: string };
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'type-alias',
          name: 'UserWithRole',
          qualifiedName: 'UserWithRole',
          exported: true,
        },
      ],
    },

    // ========================================================================
    // IMPORT/EXPORT SCENARIOS
    // ========================================================================
    {
      name: 'File with imports',
      description: 'File with various import statements',
      code: `
import { Component } from '@angular/core';
import * as React from 'react';
import defaultExport from './module';
import type { User } from './types';

export function useUser(): User {
  return { id: '1', name: 'John' };
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'useUser',
          qualifiedName: 'useUser',
          exported: true,
          hasDependencies: true,
        },
      ],
    },
    {
      name: 'Default export function',
      description: 'Default export',
      code: `
export default function main() {
  console.log('Main function');
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'main',
          qualifiedName: 'main',
          exported: true,
          exportName: 'default',
        },
      ],
    },
    {
      name: 'Named exports',
      description: 'Multiple named exports',
      code: `
export const PI = 3.14159;
export function calculate() {}
export class Calculator {}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'function',
          name: 'calculate',
          qualifiedName: 'calculate',
          exported: true,
        },
        {
          type: 'class',
          name: 'Calculator',
          qualifiedName: 'Calculator',
          exported: true,
        },
      ],
    },

    // ========================================================================
    // COMPLEX SCENARIOS
    // ========================================================================
    {
      name: 'Mixed declarations',
      description: 'File with multiple types of declarations',
      code: `
import { Request, Response } from 'express';

export interface User {
  id: string;
}

export class UserService {
  async getUser(id: string): Promise<User> {
    return { id };
  }
}

export function createUser(name: string): User {
  return { id: '1', name };
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'interface',
          name: 'User',
          qualifiedName: 'User',
          exported: true,
        },
        {
          type: 'class',
          name: 'UserService',
          qualifiedName: 'UserService',
          exported: true,
        },
        {
          type: 'function',
          name: 'createUser',
          qualifiedName: 'createUser',
          exported: true,
        },
      ],
    },
    {
      name: 'Deeply nested structure',
      description: 'Nested classes and functions',
      code: `
export class Outer {
  method() {
    class Inner {
      nestedMethod() {
        function deepest() {
          return 42;
        }
        return deepest();
      }
    }
    return new Inner();
  }
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'class',
          name: 'Outer',
          qualifiedName: 'Outer',
          exported: true,
        },
        {
          type: 'method',
          name: 'method',
          qualifiedName: 'Outer.method',
        },
      ],
    },
    {
      name: 'Module with namespace',
      description: 'Namespace declaration',
      code: `
export namespace Utils {
  export function helper() {}
  export class Helper {}
}
      `.trim(),
      filePath: 'test.ts',
      expectedChunks: [
        {
          type: 'namespace',
          name: 'Utils',
          qualifiedName: 'Utils',
          exported: true,
        },
      ],
    },
  ];

  // Run all scenarios
  scenarios.forEach((scenario) => {
    const testFn = scenario.skip ? it.skip : it;

    testFn(`should handle: ${scenario.name}`, () => {
      const chunks = chunker.chunkCode(scenario.code, scenario.filePath);

      // Log actual results for debugging
      if (chunks.length !== (scenario.expectedCount ?? scenario.expectedChunks.length)) {
        console.log(`\n=== Scenario: ${scenario.name} ===`);
        console.log('Expected chunks:', scenario.expectedChunks.length);
        console.log('Actual chunks:', chunks.length);
        console.log('Actual chunks:', JSON.stringify(chunks.map(c => ({
          type: c.type,
          name: c.name,
          qualifiedName: c.qualifiedName,
          exported: c.exported
        })), null, 2));
      }

      // Check total count if specified
      if (scenario.expectedCount !== undefined) {
        expect(chunks.length).toBe(scenario.expectedCount);
      } else {
        expect(chunks.length).toBeGreaterThanOrEqual(scenario.expectedChunks.length);
      }

      // Check each expected chunk
      scenario.expectedChunks.forEach((expected) => {
        const actual = findMatchingChunk(chunks, expected);

        if (!actual) {
          console.error(`\nMissing expected chunk:`, expected);
          console.error('Available chunks:', chunks.map(c => ({
            type: c.type,
            name: c.name,
            qualifiedName: c.qualifiedName
          })));
        }

        expect(actual).toBeDefined();

        if (actual) {
          verifyChunk(actual, expected);
        }
      });

      // Check types if specified
      if (scenario.expectedTypes) {
        const actualTypes = chunks.map(c => c.type);
        scenario.expectedTypes.forEach(expectedType => {
          expect(actualTypes).toContain(expectedType);
        });
      }
    });
  });

  /**
   * Find a chunk that matches the expected criteria
   */
  function findMatchingChunk(chunks: Chunk[], expected: ExpectedChunk): Chunk | undefined {
    return chunks.find((chunk) => {
      if (chunk.type !== expected.type) return false;
      if (chunk.name !== expected.name) return false;
      if (expected.qualifiedName && chunk.qualifiedName !== expected.qualifiedName) return false;
      if (expected.exported !== undefined && chunk.exported !== expected.exported) return false;
      if (expected.parentName && chunk.parentId) {
        // Check if parent matches (simplified check)
        const parentChunk = chunks.find(c => c.id === chunk.parentId);
        if (parentChunk?.name !== expected.parentName) return false;
      }
      return true;
    });
  }

  /**
   * Verify chunk matches expected properties
   */
  function verifyChunk(actual: Chunk, expected: ExpectedChunk): void {
    expect(actual.type).toBe(expected.type);
    expect(actual.name).toBe(expected.name);

    if (expected.qualifiedName) {
      expect(actual.qualifiedName).toBe(expected.qualifiedName);
    }

    if (expected.exported !== undefined) {
      expect(actual.exported).toBe(expected.exported);
    }

    if (expected.exportName !== undefined) {
      expect(actual.exportName).toBe(expected.exportName);
    }

    if (expected.async !== undefined) {
      expect(actual.async).toBe(expected.async);
    }

    if (expected.generator !== undefined) {
      expect(actual.generator).toBe(expected.generator);
    }

    if (expected.visibility !== undefined) {
      expect(actual.visibility).toBe(expected.visibility);
    }

    if (expected.parametersCount !== undefined) {
      expect(actual.parameters.length).toBe(expected.parametersCount);
    }

    if (expected.returnType !== undefined) {
      expect(actual.returnType).toBe(expected.returnType);
    }

    if (expected.hasContent !== undefined && expected.hasContent) {
      expect(actual.content).toBeDefined();
      expect(actual.content?.length).toBeGreaterThan(0);
    }

    if (expected.hasDependencies !== undefined && expected.hasDependencies) {
      expect(actual.dependencies.length).toBeGreaterThan(0);
    }

    if (expected.childrenCount !== undefined) {
      expect(actual.childrenIds.length).toBe(expected.childrenCount);
    }

    if (expected.startLine !== undefined) {
      expect(actual.startLine).toBe(expected.startLine);
    }

    if (expected.endLine !== undefined) {
      expect(actual.endLine).toBe(expected.endLine);
    }
  }
});
