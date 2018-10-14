'use strict';

const Generator = require('yeoman-generator');
const _chalk = require('chalk');
const _yosay = require('yosay');

const _awsUtils = require('../../utils/aws-utils');
const _prompts = require('../../utils/prompts');
const _consts = require('../../utils/constants');
const _package = require('../../package.json');

module.exports = class extends Generator {
    /**
     * Gather basic project information.
     */
    gatherProjectInfo() {
        const generatorTitle = `${_consts.GENERATOR_NAME} v${_package.version}`;
        this.log(
            _yosay(
                `AWS Microservice Generator.\n${_chalk.red(generatorTitle)} `
            )
        );

        this.config.set('_projectType', _consts.SUB_GEN_MICROSERVICE);
        return _prompts
            .getProjectInfo(this, true)
            .then(() => {
                return _prompts.getAuthorInfo(this, true);
            })
            .then(() => {
                return _prompts.getAwsInfo(this, true);
            });
    }

    /**
     * Creates project files
     */
    createProjectFiles() {
        [
            'package.json',
            'Gruntfile.js',
            'README.md',
            '_gitignore',
            '_npmignore',
            '_projections.json',
            '_prettierrc',
            '_eslintrc.json',
            'src/lambda-config.json',
            'src/index.js',
            'test/unit/index-spec.js',
            'docs/index.md'
        ].forEach((srcFile) => {
            const destFile =
                srcFile.indexOf('_') === 0
                    ? srcFile.replace('_', '.')
                    : srcFile;
            this.fs.copyTpl(
                this.templatePath(srcFile),
                this.destinationPath(destFile),
                this.props
            );
        });
        this.fs.copyTpl(
            this.templatePath('_rc'),
            this.destinationPath(`.${this.props.projectName}rc`),
            this.props
        );
    }

    ensureS3Bucket() {
        if (this.props.awsS3BucketCreate) {
            const { awsS3Bucket: bucket, awsProfile: profile } = this.props;
            this.log(`Creating S3 bucket: ${bucket}`);
            _awsUtils.createS3Bucket(bucket, profile).then(
                () => {
                    this.log(_chalk.green(`S3 bucket created: ${bucket}`));
                },
                (err) => {
                    [
                        `Error creating S3 bucket (${bucket}).`,
                        'Please ensure that the bucket exists with appropriate permissions before',
                        'attempting to deploy your microservice'
                    ].forEach((line) => this.log(_chalk.red(line)));
                }
            );
        }
    }

    /**
     * Finish the rest of the main flow by composing sub generators.
     */
    compose() {
        this.composeWith(`${_consts.GENERATOR_NAME}:${_consts.SUB_GEN_LAMBDA}`);
    }

    /**
     * Display completed message with future actions.
     */
    finish() {
        const grunt = _chalk.green('grunt');
        const gruntTestCommand = _chalk.yellow('test');
        const gruntMonitorUnitCommand = _chalk.yellow('monitor:unit');
        const gruntMonitorApiCommand = _chalk.yellow('monitor:api');
        const gruntFormatCommand = _chalk.yellow('format');
        const gruntLintCommand = _chalk.yellow('lint');
        const gruntHelpCommand = _chalk.yellow('help');
        const gruntDocsCommand = _chalk.yellow('docs');
        const gruntPackageCommand = _chalk.yellow('package');
        const gruntPublishCommand = _chalk.yellow('package');

        this.log(_consts.SEPARATOR);
        [
            `                                                                                `,
            `--------------------------------------------------------------------------------`,
            ` Your AWS Microservice project has been created, and is ready for use. Grunt    `,
            ` tasks have been provided for common development tasks such as:                 `,
            `                                                                                `,
            ` Running all unit tests:                                                        `,
            `   ${grunt} ${gruntTestCommand}                                                 `,
            `                                                                                `,
            ` Test driven development:                                                       `,
            `   ${grunt} ${gruntMonitorUnitCommand}                                          `,
            `                                                                                `,
            ` Run end to end tests against deployed lambda functions:                        `,
            `   ${grunt} ${gruntMonitorApiCommand}                                           `,
            `                                                                                `,
            ` Formatting and linting files:                                                  `,
            `   ${grunt} ${gruntFormatCommand}                                               `,
            `   ${grunt} ${gruntLintCommand}                                                 `,
            `                                                                                `,
            ` Generating documentation:                                                      `,
            `   ${grunt} ${gruntDocsCommand}                                                 `,
            `                                                                                `,
            ` Packaging the lambda functions for deployment:                                 `,
            `   ${grunt} ${gruntPackageCommand}                                              `,
            `                                                                                `,
            ` Publishing lambda functions to AWS:                                            `,
            `   ${grunt} ${gruntPublishCommand}                                              `,
            `                                                                                `,
            ` Several other useful tasks have been packaged up with the Gruntfile. You can   `,
            ` review them all by running:                                                    `,
            `   ${grunt} ${gruntHelpCommand}                                                 `,
            `                                                                                `,
            ` NOTE: This project will support the use of cloud formation scripts to create   `,
            ` and deploy AWS resources. This support is currently not available, is being    `,
            ` worked on.                                                                     `,
            `                                                                                `,
            `--------------------------------------------------------------------------------`,
            `                                                                                `
        ].forEach((line) => this.log(line));
    }
};
