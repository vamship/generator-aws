'use strict';

const { argValidator: _argValidator } = require('@vamship/arg-utils');
const _awsUtils = require('./aws-utils');
const _semver = require('semver');

const CUSTOM_PROFILE_CHOICE = '-- type in a profile --';
const CUSTOM_REGION_CHOICE = '-- type in a region --';

/**
 * Returns a function that selects the default index from an asynchronously
 * loaded list. The selection index is determined based on the position of
 * the provided value in the list. If no match is found, the last element in
 * the list is selected.
 *
 * @private
 * @param {String} value The value of the selection from the list
 * @return {Function} A function that returns the selected value.
 */
function _getAsyncSelectedIndex(value) {
    return (list) => {
        let selected = list.indexOf(value);
        if (selected < 0) {
            selected = list.length - 1;
        }
        return selected;
    };
}

module.exports = {
    /**
     * Prompts a user for project information that is not already known.
     *
     * @param {Object} gen Reference to the generator that is invoking
     *        the prompts.
     * @param {Booleabn} force A parameter that forces re prompting even if
     *        values exist in the config file.
     * @return {Promise} A promise that is resolved/rejected after user input
     *         is completed.
     */
    getProjectInfo: function(gen, force) {
        const properties = [
            'projectNamespace',
            'projectName',
            'projectVersion',
            'projectPrefix',
            'projectDescription',
            'projectKeywords'
        ];
        const config = {};
        properties.forEach((propName) => {
            config[propName] = gen.config.get(propName);
        });

        const prompts = [];

        if (config.projectNamespace === undefined || force) {
            prompts.push({
                type: 'input',
                name: 'projectNamespace',
                message: 'Project namespace (leave empty if none)?',
                default: config.projectNamespace || '',
                validate: (answer) => {
                    if (answer !== '' && !answer.startsWith('@')) {
                        return 'Namespaces must start with a "@"';
                    }
                    return true;
                }
            });
        }

        if (!config.projectName || force) {
            prompts.push({
                type: 'input',
                name: 'projectName',
                message: 'Project name?',
                default: (config.projectName || gen.appname).replace(/\s/g, '-')
            });
        }

        if (!config.projectVersion || force) {
            prompts.push({
                type: 'input',
                name: 'projectVersion',
                message: 'Project version?',
                default: config.projectVersion || '0.0.1',
                validate: (answer) => {
                    if (!_semver.valid(answer)) {
                        return 'Please enter a SemVer compatible version string';
                    }
                    return true;
                }
            });
        }

        if (!config.projectPrefix || force) {
            prompts.push({
                type: 'input',
                name: 'projectPrefix',
                message: 'Project prefix?',
                default: (answers) => {
                    const prefixChars = answers.projectName
                        .split('-')
                        .map((token) => token.substring(0, 1));
                    for (let index = prefixChars.length; index < 3; index++) {
                        prefixChars.push(0);
                    }
                    prefixChars.splice(3);
                    return prefixChars.join('');
                }
            });
        }

        if (!config.projectDescription || force) {
            prompts.push({
                type: 'input',
                name: 'projectDescription',
                message: 'Project description?',
                default: config.projectDescription || 'My AWS microservice'
            });
        }

        if (!config.projectKeywords || force) {
            prompts.push({
                type: 'input',
                name: 'projectKeywords',
                message: 'Project keywords (comma separated)?',
                default: config.projectKeywords || [],
                filter: (answer) => {
                    if (answer instanceof Array) {
                        return answer;
                    }
                    return answer
                        .split(',')
                        .map((keyword) => `${keyword.trim()}`)
                        .filter((keyword) => !!keyword);
                }
            });
        }

        return gen.prompt(prompts).then((props) => {
            gen.props = gen.props || {};

            const { projectNamespace, projectName } = props;
            gen.props.projectNamespacedName = projectName;
            if (projectNamespace !== '') {
                gen.props.projectNamespacedName = `${projectNamespace}/${projectName}`;
            }

            properties.forEach((propName) => {
                let propValue = props[propName];
                if (propValue === undefined) {
                    propValue = config[propName];
                }

                gen.props[propName] = propValue;
                gen.config.set(propName, propValue);
            });
        });
    },

    /**
     * Prompts a user for author information that is not already known.
     *
     * @param {Object} gen Reference to the generator that is invoking
     *        the prompts.
     * @param {Booleabn} force A parameter that forces re prompting even if
     *        values exist in the config file.
     * @return {Promise} A promise that is resolved/rejected after user input
     *         is completed.
     */
    getAuthorInfo: function(gen, force) {
        const properties = [
            'authorName',
            'authorEmail',
            'gitUsername',
            'gitUrl',
            'gitDocumentationUrl'
        ];
        const config = {};
        properties.forEach((propName) => {
            config[propName] = gen.config.get(propName);
        });

        const prompts = [];

        if (!config.authorName || force) {
            prompts.push({
                type: 'input',
                name: 'authorName',
                message: 'Author name?',
                default: config.authorName || '__NA__'
            });
        }

        if (!config.authorEmail || force) {
            prompts.push({
                type: 'input',
                name: 'authorEmail',
                message: 'Author email?',
                default: config.authorEmail || '__NA__'
            });
        }

        if (!config.gitUsername || force) {
            prompts.push({
                type: 'input',
                name: 'gitUsername',
                message: 'Git username?',
                default: (answers) => {
                    if (config.gitUsername) {
                        return config.gitUsername;
                    }
                    if (
                        gen.props &&
                        typeof gen.props.projectNamespace === 'string'
                    ) {
                        return gen.props.projectNamespace.substr(1);
                    }
                    return config.gitUsername || '__NA__';
                }
            });
        }

        if (!config.gitUrl || force) {
            prompts.push({
                type: 'input',
                name: 'gitUrl',
                message: 'Git URL?',
                default: (answers) =>
                    `github.com/${answers.gitUsername}/${gen.config.get(
                        'projectName'
                    )}`
            });
        }

        if (!config.gitDocumentationUrl || force) {
            prompts.push({
                type: 'input',
                name: 'gitDocumentationUrl',
                message: 'Documentation URL?',
                default: (answers) => {
                    if (config.gitDocumentationUrl) {
                        return config.gitDocumentationUrl;
                    }
                    return `https://${
                        answers.gitUsername
                    }.github.io/${gen.config.get('projectName')}`;
                }
            });
        }

        return gen.prompt(prompts).then((props) => {
            gen.props = gen.props || {};
            properties.forEach((propName) => {
                let propValue = props[propName];
                if (propValue === undefined) {
                    propValue = config[propName];
                }

                gen.props[propName] = propValue;
                gen.config.set(propName, propValue);
            });
        });
    },

    /**
     * Prompts a user for AWS information that is not already known.
     *
     * @param {Object} gen Reference to the generator that is invoking
     *        the prompts.
     * @param {Booleabn} force A parameter that forces re prompting even if
     *        values exist in the config file.
     * @return {Promise} A promise that is resolved/rejected after user input
     *         is completed.
     */
    getAwsInfo: function(gen, force) {
        const properties = [
            'awsProfile',
            'awsRegion',
            'awsS3Bucket',
            'awsS3BucketCreate'
        ];
        const config = {};
        properties.forEach((propName) => {
            config[propName] = gen.config.get(propName);
        });

        const prompts = [];
        if (!config.awsProfile || force) {
            prompts.push({
                type: 'list',
                name: 'awsProfile',
                message: 'AWS profile?',
                choices: () => _awsUtils.getProfileList(CUSTOM_PROFILE_CHOICE),
                default: () => {
                    return _awsUtils
                        .getProfileList(CUSTOM_PROFILE_CHOICE)
                        .then(_getAsyncSelectedIndex(config.awsProfile));
                }
            });

            prompts.push({
                type: 'input',
                name: 'awsProfileCustom',
                message: 'Enter AWS profile name',
                when: (answers) => {
                    return answers.awsProfile === CUSTOM_PROFILE_CHOICE;
                },
                validate: (answer) => {
                    if (!_argValidator.checkString(answer, 1)) {
                        return 'Please enter a non empty value';
                    }
                    return true;
                }
            });
        }
        if (!config.awsRegion || force) {
            prompts.push({
                type: 'list',
                name: 'awsRegion',
                message: 'AWS region?',
                when: (answers) => {
                    const customProfile = answers.awsProfileCustom;
                    return !_argValidator.checkString(customProfile, 1);
                },
                choices: (answers) => {
                    return _awsUtils.getRegionList(
                        answers.awsProfile,
                        CUSTOM_REGION_CHOICE
                    );
                },
                default: (answers) => {
                    return _awsUtils
                        .getRegionList(answers.awsProfile, CUSTOM_REGION_CHOICE)
                        .then(_getAsyncSelectedIndex(config.awsRegion));
                }
            });

            prompts.push({
                type: 'input',
                name: 'awsRegionCustom',
                message: 'Enter AWS region name',
                when: (answers) => {
                    const customProfile = answers.awsProfileCustom;
                    return (
                        _argValidator.checkString(customProfile, 1) ||
                        answers.awsRegion === CUSTOM_REGION_CHOICE
                    );
                },
                validate: (answer) => {
                    if (!_argValidator.checkString(answer, 1)) {
                        return 'Please enter a non empty value';
                    }
                    return true;
                }
            });
        }
        if (!config.awsS3Bucket || force) {
            prompts.push({
                type: 'input',
                name: 'awsS3Bucket',
                message: 'AWS S3 bucket for deployment files?',
                validate: (answer) => {
                    if (!_argValidator.checkString(answer, 1)) {
                        return 'Please enter a non empty value';
                    }
                    return true;
                },
                default: config.awsS3Bucket
            });
            prompts.push({
                type: 'confirm',
                name: 'awsS3BucketCreate',
                message: 'Bucket does not exist. Create?',
                when: (answers) => {
                    const {
                        awsProfile: profile,
                        awsS3Bucket: bucket,
                        awsProfileCustom: customProfile
                    } = answers;

                    if (!_argValidator.checkString(customProfile, 1)) {
                        return _awsUtils
                            .checkBucketExists(bucket, profile)
                            .then((exists) => {
                                return !exists;
                            });
                    }
                    return false;
                },
                default: () => {
                    const { awsS3Bucket } = config;
                    return awsS3Bucket !== undefined ? true : awsS3Bucket;
                }
            });
        }

        return gen.prompt(prompts).then((props) => {
            gen.props = gen.props || {};
            properties.forEach((propName) => {
                let propValue = props[propName];
                if (propValue === undefined) {
                    propValue = config[propName];
                }

                if (propName === 'awsProfile') {
                    const customProfile = props['awsProfileCustom'];
                    if (_argValidator.checkString(customProfile, 1)) {
                        propValue = customProfile;
                    }
                }

                if (propName === 'awsRegion') {
                    const customRegion = props['awsRegionCustom'];
                    if (_argValidator.checkString(customRegion, 1)) {
                        propValue = customRegion;
                    }
                }

                gen.props[propName] = propValue;
                gen.config.set(propName, propValue);
            });
        });
    }
};
