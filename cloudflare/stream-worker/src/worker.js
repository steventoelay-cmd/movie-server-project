import mod from './extract.js';

export default {
  async fetch(request, env, ctx) {
    const response = await mod.handleWorkerRequest(request, env);
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(Promise.resolve());
    }
    return response;
  },
};
