'use strict';

<%if (lambdaSchemaCreate) {-%>
const { schemaHelper: _schemaHelper } = require('@vamship/arg-utils');
const _schema = require('../schema/<%= lambdaSchemaFile %>');
const _schemaChecker = _schemaHelper.createSchemaChecker(_schema);
<%} -%>

/**
 * <%= lambdaFunctionDescription %>
 *
 * @param {Object} event The lambda event object
 * @param {Object} context The lambda context object
 * @param {Object} ext Extended properties containing references to injected
 *        properties such as config, logger, etc.
 */
const handler = (event, context, ext) => {
    const { logger, config, alias } = ext;

    logger.trace('Executing lambda handler', { config, alias });

<%if (lambdaSchemaCreate) {-%>
    logger.info('Performing schema validation');
    _schemaChecker(event, true);

    logger.info('Schema validation successful');
<%} else {-%>
    logger.info('Skipping schema validation');
<%} -%>

    //TODO: Do something here and return:
    // (1) Promise - for async operations.
    // (2) * - for all other operations
    return 'Lambda function [<%= lambdaFunctionName %>] executed successfully';
};

module.exports = handler;
