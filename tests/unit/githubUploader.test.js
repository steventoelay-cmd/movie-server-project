'use strict';

describe('GitHubUploader (mocked)', () => {
  test('non-2xx response becomes GitHubError', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('axios', () =>
        jest.fn(async () => ({
          status: 503,
          data: { message: 'Service Unavailable' },
          headers: {},
        })),
      );

      const { GitHubUploader } = require('../../src/infrastructure/github/upload/GitHubUploader');
      const { GitHubError } = require('../../src/domain/errors/GitHubError');

      const uploader = new GitHubUploader({
        config: {
          token: 'test-token',
          owner: 'owner',
          repo: 'repo',
          branch: 'main',
          basePath: '',
          apiBase: 'https://api.github.com',
          retries: 0,
          retryBaseMs: 1,
        },
        auth: {
          headers: () => ({ Authorization: 'Bearer test-token' }),
          isConfigured: () => true,
        },
        logger: { debug() {}, info() {}, warn() {}, error() {} },
      });

      try {
        await uploader.request('GET', 'https://api.github.com/repos/owner/repo');
        throw new Error('expected request to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubError);
        expect(error.code).toBe('GITHUB_API_ERROR');
        expect(error.statusCode).toBe(503);
      }
    });
  });
});
