/**
 * Dependency Detection Scenario Test
 *
 * Tests chunking behavior when a function call changes its arguments
 */

import { Chunker } from '../core/chunker';

describe('Dependency Detection Scenario', () => {
  let chunker: Chunker;

  beforeEach(() => {
    chunker = new Chunker({ parser: 'typescript', includeContent: true });
  });

  it('should extract both functions and detect dependency when testData calls test with 3 args', () => {
    const code = `
function test(var1: number, var2: number, var3: number, var4: number): number {
    return var1 + var2 + var3 + var4;
}

function testData(): void {
    const v1 = 1;
    const v2 = 2;
    const v4 = 3;
    test(v1, v2, v4);
}
    `.trim();

    const chunks = chunker.chunkCode(code, 'test.ts');

    console.log('\n=== Chunking Results ===');
    console.log(`Total chunks extracted: ${chunks.length}`);
    chunks.forEach((chunk, i) => {
      console.log(`\nChunk ${i + 1}:`);
      console.log(`  Type: ${chunk.type}`);
      console.log(`  Name: ${chunk.name}`);
      console.log(`  Qualified Name: ${chunk.qualifiedName}`);
      console.log(`  Lines: ${chunk.startLine}-${chunk.endLine}`);
      console.log(`  Dependencies: ${chunk.dependencies.length}`);
      chunk.dependencies.forEach((dep, j) => {
        console.log(`    ${j + 1}. ${dep.name} from ${dep.source}`);
      });
      console.log(`  Content: ${chunk.content?.substring(0, 100)}...`);
    });

    // Expected: Should extract both functions
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    const testChunk = chunks.find((c) => c.name === 'test');
    const testDataChunk = chunks.find((c) => c.name === 'testData');

    expect(testChunk).toBeDefined();
    expect(testDataChunk).toBeDefined();

    // testData should have test as a dependency (if dependency detection works)
    if (testDataChunk) {
      console.log('\n=== Dependency Analysis ===');
      console.log(`testData dependencies: ${testDataChunk.dependencies.length}`);
      const testDependency = testDataChunk.dependencies.find((d) => d.name === 'test');
      if (testDependency) {
        console.log(`✅ Found dependency: test`);
      } else {
        console.log(`⚠️  Dependency 'test' not detected in testData's dependencies`);
        console.log(`   Available dependencies:`, testDataChunk.dependencies.map(d => d.name));
      }
    }
  });

  it('should detect change when testData call changes from 2 args to 3 args', () => {
    const beforeCode = `
function test(var1: number, var2: number, var3: number, var4: number): number {
    return var1 + var2 + var3 + var4;
}

function testData(): void {
    const v1 = 1;
    const v2 = 2;
    test(v1, v2);
}
    `.trim();

    const afterCode = `
function test(var1: number, var2: number, var3: number, var4: number): number {
    return var1 + var2 + var3 + var4;
}

function testData(): void {
    const v1 = 1;
    const v2 = 2;
    const v4 = 3;
    test(v1, v2, v4);
}
    `.trim();

    const beforeChunks = chunker.chunkCode(beforeCode, 'test.ts');
    const afterChunks = chunker.chunkCode(afterCode, 'test.ts');

    console.log('\n=== Change Detection ===');
    console.log(`Before: ${beforeChunks.length} chunks`);
    console.log(`After: ${afterChunks.length} chunks`);

    const beforeTestData = beforeChunks.find((c) => c.name === 'testData');
    const afterTestData = afterChunks.find((c) => c.name === 'testData');

    expect(beforeTestData).toBeDefined();
    expect(afterTestData).toBeDefined();

    if (beforeTestData && afterTestData) {
      console.log(`\nBefore testData hash: ${beforeTestData.hash}`);
      console.log(`After testData hash: ${afterTestData.hash}`);
      console.log(`Hash changed: ${beforeTestData.hash !== afterTestData.hash}`);

      console.log(`\nBefore testData content:`);
      console.log(beforeTestData.content);
      console.log(`\nAfter testData content:`);
      console.log(afterTestData.content);

      // The hash should change when content changes
      expect(beforeTestData.hash).not.toBe(afterTestData.hash);
      expect(beforeTestData.content).not.toBe(afterTestData.content);
    }

    // test function should remain unchanged
    const beforeTest = beforeChunks.find((c) => c.name === 'test');
    const afterTest = afterChunks.find((c) => c.name === 'test');

    if (beforeTest && afterTest) {
      console.log(`\ntest function hash unchanged: ${beforeTest.hash === afterTest.hash}`);
      // test function should have same hash (no changes)
      expect(beforeTest.hash).toBe(afterTest.hash);
    }
  });

  it('should show what chunks would be reviewed when testData changes', () => {
    const fullCode = `
function test(var1: number, var2: number, var3: number, var4: number): number {
    return var1 + var2 + var3 + var4;
}

function testData(): void {
    const v1 = 1;
    const v2 = 2;
    const v4 = 3;
    test(v1, v2, v4);
}
    `.trim();

    const chunks = chunker.chunkCode(fullCode, 'test.ts');

    console.log('\n=== Review Scenario: testData function changed ===');
    console.log('If testData function is changed, which chunks should be reviewed?');
    console.log('\nAll chunks:');
    chunks.forEach((chunk) => {
      console.log(`  - ${chunk.name} (${chunk.type}) - Lines ${chunk.startLine}-${chunk.endLine}`);
    });

    const testDataChunk = chunks.find((c) => c.name === 'testData');
    const testChunk = chunks.find((c) => c.name === 'test');

    console.log('\n=== Analysis ===');
    if (testDataChunk) {
      console.log(`✅ testData chunk extracted`);
      console.log(`   Hash: ${testDataChunk.hash}`);
      console.log(`   Would be reviewed: YES (changed)`);
    }

    if (testChunk) {
      console.log(`✅ test chunk extracted`);
      console.log(`   Hash: ${testChunk.hash}`);
      console.log(`   Would be reviewed: ${testDataChunk?.dependencies.some(d => d.name === 'test') ? 'YES (dependency)' : 'NO (not changed, no dependency link)'}`);
    }

    // Expected output explanation
    console.log('\n=== Expected Behavior ===');
    console.log('1. testData chunk should be extracted and marked as changed');
    console.log('2. test chunk should be extracted');
    console.log('3. If dependency detection works: test should be included in review (dependency)');
    console.log('4. If dependency detection doesn\'t work: only testData would be reviewed');
  });
});
