import { describe, it, expect } from 'vitest';
import { PostScanner } from '../src/content/post-scanner.js';
import type { PlatformAdapter, RawHiringPost } from '../src/shared/types.js';

describe('Scanner State Management', () => {
  const createMockAdapter = (posts: (RawHiringPost | null)[]): PlatformAdapter => {
    let index = 0;
    return {
      platformName: 'linkedin',
      isSupportedPage: () => true,
      findPosts: () => {
        // Return dummy elements representing available posts
        return posts.map((_, i) => {
          const el = document.createElement('div');
          el.setAttribute('data-id', `mock_${i}`);
          return el;
        });
      },
      extractPost: () => {
        if (index < posts.length) {
          const post = posts[index];
          index++;
          return post;
        }
        return null;
      },
      loadMore: async () => false,
      expandPostText: async () => {},
      getSearchContext: () => ({ query: 'Golang hiring', pageUrl: 'https://www.linkedin.com/search/results/content/' }),
    };
  };

  it('transitions from idle -> preparing -> scanning -> complete when target is reached', async () => {
    const statesRecorded: string[] = [];

    const mockPosts: RawHiringPost[] = [
      {
        id: 'post_1',
        platform: 'linkedin',
        text: 'Hiring Go dev! Contact hiring@go.com',
        emails: ['hiring@go.com'],
        extractedAt: new Date().toISOString(),
      },
      {
        id: 'post_2',
        platform: 'linkedin',
        text: 'Backend engineer wanted: jobs@server.io',
        emails: ['jobs@server.io'],
        extractedAt: new Date().toISOString(),
      },
    ];

    const adapter = createMockAdapter(mockPosts);
    const scanner = new PostScanner(adapter, (progress) => {
      if (!statesRecorded.includes(progress.state)) {
        statesRecorded.push(progress.state);
      }
    });

    expect(scanner.getProgress().state).toBe('idle');

    const result = await scanner.startScan({ targetCount: 2 });

    expect(result.state).toBe('complete');
    expect(result.postsMatched).toBe(2);
    expect(statesRecorded).toContain('preparing');
    expect(statesRecorded).toContain('scanning');
    expect(statesRecorded).toContain('complete');
  });

  it('transitions to stopped when stopScan is called during scanning', async () => {
    const mockPosts: RawHiringPost[] = [
      {
        id: 'post_1',
        platform: 'linkedin',
        text: 'Hiring React dev: jobs@react.com',
        emails: ['jobs@react.com'],
        extractedAt: new Date().toISOString(),
      },
    ];

    const adapter = createMockAdapter(mockPosts);
    let scannerRef: PostScanner;
    const scanner = new PostScanner(adapter, (progress) => {
      // Trigger stop as soon as scanning starts
      if (progress.state === 'scanning') {
        scannerRef.stopScan();
      }
    });
    scannerRef = scanner;

    const result = await scanner.startScan({ targetCount: 10 });

    expect(result.state).toBe('stopped');
  });

  it('transitions to error state if adapter throws an unexpected exception', async () => {
    const errorAdapter: PlatformAdapter = {
      platformName: 'linkedin',
      isSupportedPage: () => true,
      findPosts: () => {
        throw new Error('Simulated DOM access restriction');
      },
      extractPost: () => null,
      loadMore: async () => false,
      expandPostText: async () => {},
      getSearchContext: () => ({}),
    };

    const scanner = new PostScanner(errorAdapter);
    const result = await scanner.startScan({ targetCount: 5 });

    expect(result.state).toBe('error');
    expect(result.errorMessage).toContain('Simulated DOM access restriction');
  });
});
