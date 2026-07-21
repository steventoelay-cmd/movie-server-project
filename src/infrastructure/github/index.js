'use strict';

module.exports = {
  GitHubSyncService: require('./GitHubSyncService').GitHubSyncService,
  GitHubAuth: require('./auth/GitHubAuth').GitHubAuth,
  JsonComparer: require('./compare/JsonComparer').JsonComparer,
  GitHubUploader: require('./upload/GitHubUploader').GitHubUploader,
  GitHubCommitter: require('./commit/GitHubCommitter').GitHubCommitter,
  GitHubRollback: require('./rollback/GitHubRollback').GitHubRollback,
  GitHubVersion: require('./version/GitHubVersion').GitHubVersion,
};
