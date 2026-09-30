import { describe, it, expect } from 'vitest';
import { LinkedInAdapter } from '../src/content/linkedin-adapter.js';

describe('Post Filtering Pipeline', () => {
  const adapter = new LinkedInAdapter();

  it('includes posts containing a detected email', () => {
    // Mock DOM element with email
    const container = document.createElement('div');
    container.setAttribute('data-urn', 'urn:li:activity:123456');

    const textDiv = document.createElement('div');
    textDiv.className = 'feed-shared-inline-show-more-text';
    textDiv.innerText =
      'We are hiring Golang engineers!\nExperience: 3-5 years\nLocation: Remote\nSend resume to: hiring@techcompany.com';
    container.appendChild(textDiv);

    const post = adapter.extractPost(container);

    expect(post).not.toBeNull();
    expect(post?.emails).toEqual(['hiring@techcompany.com']);
    expect(post?.platform).toBe('linkedin');
    expect(post?.text).toContain('We are hiring Golang engineers');
  });

  it('excludes posts without a contact email', () => {
    // Mock DOM element without email
    const container = document.createElement('div');
    container.setAttribute('data-urn', 'urn:li:activity:789012');

    const textDiv = document.createElement('div');
    textDiv.className = 'feed-shared-inline-show-more-text';
    textDiv.innerText = 'We are hiring Golang developers. DM me if interested or check our career page!';
    container.appendChild(textDiv);

    const post = adapter.extractPost(container);

    // CRITICAL FILTER: Must be null
    expect(post).toBeNull();
  });

  it('excludes posts directing candidates to generic links without email', () => {
    const container = document.createElement('div');
    container.setAttribute('data-urn', 'urn:li:activity:999999');

    const textDiv = document.createElement('div');
    textDiv.className = 'feed-shared-inline-show-more-text';
    textDiv.innerText = 'Excited to announce multiple software openings! Apply through the link below in comments.';
    container.appendChild(textDiv);

    const post = adapter.extractPost(container);
    expect(post).toBeNull();
  });

  it('preserves the original visible post text for future LLM pipelines', () => {
    const rawPostContent = `🚀 Urgent Hiring: Senior Python Backend Developer

Company: DataScale Systems
Location: Bangalore / Hybrid
Tech Stack: Python, FastAPI, Docker, PostgreSQL

Requirements:
- 4+ years of backend development
- Experience with microservices

To apply, please email your resume and GitHub profile to: careers@datascale.io`;

    const container = document.createElement('div');
    container.setAttribute('data-urn', 'urn:li:activity:555555');

    const textDiv = document.createElement('div');
    textDiv.className = 'feed-shared-inline-show-more-text';
    textDiv.innerText = rawPostContent;
    container.appendChild(textDiv);

    const post = adapter.extractPost(container);

    expect(post).not.toBeNull();
    // Raw text should be preserved intact with newlines and structure
    expect(post?.text).toContain('DataScale Systems');
    expect(post?.text).toContain('Python, FastAPI, Docker, PostgreSQL');
    expect(post?.emails).toContain('careers@datascale.io');
  });

  it('extracts real-world LinkedIn post from user screenshot (James R. hiring Golang + preethi.n@techilaservices.com)', () => {
    // Structure of modern LinkedIn search card
    const card = document.createElement('div');
    card.className = 'artdeco-card';

    // Actor header
    const actor = document.createElement('div');
    actor.className = 'update-components-actor';
    actor.innerHTML = `
      <div class="update-components-actor__title">
        <span aria-hidden="true">James R.</span>
      </div>
      <div class="update-components-actor__subtitle">
        <span>Founder 'World IT Jobs' | 110k+ LinkedIn | Follow World IT Jobs</span>
      </div>
    `;
    card.appendChild(actor);

    // Post content container
    const content = document.createElement('div');
    content.className = 'feed-shared-update-v2__description-wrapper';
    content.innerText = `HIRING | Golang + Python + Kubernetes
Location: Bangalore
Work Mode: Hybrid
Experience: 3+ Years

Interested candidates: Share your updated CV via mail given below
preethi.n@techilaservices.com

Important:
Please do not comment "Interested."`;
    card.appendChild(content);

    // Social actions
    const social = document.createElement('div');
    social.className = 'feed-shared-social-actions';
    social.innerHTML = '<button aria-label="Like">Like</button><button aria-label="Comment">Comment</button>';
    card.appendChild(social);

    document.body.appendChild(card);

    // Test findPosts discovers this card
    const foundPosts = adapter.findPosts();
    expect(foundPosts.length).toBeGreaterThan(0);

    // Test extractPost extracts James R. and preethi.n@techilaservices.com
    const extracted = adapter.extractPost(card);
    expect(extracted).not.toBeNull();
    expect(extracted?.author?.name).toBe('James R.');
    expect(extracted?.author?.headline).toContain('World IT Jobs');
    expect(extracted?.emails).toEqual(['preethi.n@techilaservices.com']);
    expect(extracted?.text).toContain('preethi.n@techilaservices.com');

    document.body.removeChild(card);
  });
});
