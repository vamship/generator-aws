'use strict';

const { Directory } = require('@vamship/grunt-utils');
const { Promise } = require('bluebird');
const _awsSdk = require('aws-sdk');
const _lambdaConfig = require('./src/lambda-config.json');

// Project specific AWS defaults
const DEFAULT_AWS_PROFILE = '<%= awsProfile %>';
const DEFAULT_AWS_REGION = '<%= awsRegion %>';

//TODO: Ensure that the bucket with the name defined below exists, and
//that the AWS profile listed above has read/write access to it.
const DEFAULT_AWS_S3_BUCKET = `<%= awsS3Bucket %>`;

// -------------------------------------------------------------------------------
//  Help documentation
// -------------------------------------------------------------------------------
//prettier-ignore
const HELP_TEXT =
'--------------------------------------------------------------------------------\n' +
' Defines tasks that are commonly used during the development process. This      \n' +
' includes tasks for linting, building and testing.                              \n' +
'                                                                                \n' +
' Supported Tasks:                                                               \n' +
'   [default]         : Shows help documentation.                                \n' +
'                                                                                \n' +
'   help              : Shows this help message.                                 \n' +
'                                                                                \n' +
'   clean             : Cleans out all build artifacts and other temporary files \n' +
'                       or directories.                                          \n' +
'                                                                                \n' +
'   monitor:[target]: : Monitors files for changes, and triggers an action based \n' +
'                       on the sub target. Supported sub targets are as follows: \n' +
'                        [lint]    : Performs linting with default options       \n' +
'                                    against all source files.                   \n' +
'                        [unit]    : Executes unit tests against all source      \n' +
'                                    files.                                      \n' +
'                        [docs]    : Regenerates project documentation based     \n' +
'                                    on typedoc.                                 \n' +
'                        [api]     : Executes all end to end (api) tests for the \n' +
'                                    microservice. These tests will hit the      \n' +
'                                    the deployed endpoints, and not the         \n' +
'                                    endpoints on the file system.               \n' +
'                                                                                \n' +
'                       The monitor task will only perform one action at a time. \n' +
'                       If watches need to be executed on multiple targets,      \n' +
'                       separate `grunt monitor` tasks may be run in parallel.   \n' +
'                                                                                \n' +
'   lint              : Performs linting of all source and test files.           \n' +
'                                                                                \n' +
'   format            : Formats source and test files.                           \n' +
'                                                                                \n' +
'   docs              : Generates project documentation.                         \n' +
'                                                                                \n' +
'   build             : Builds the project - generates javascript from           \n' +
'                       typescript sources.                                      \n' +
'                                                                                \n' +
'   dist              : Creates a distribution for the project in the dist       \n' +
'                       directory, preparing for packaging and publication.      \n' +
'                                                                                \n' +
'   packge            : Packges the api server into an archive that can be       \n' +
'                       published to AWS.                                        \n' +
'                                                                                \n' +
'   publish           : Publishes a packaged zip archive by first deploying it   \n' +
'                       to s3.                                                   \n' +
'                                                                                \n' +
'   test:[unit|api]   : Executes tests against source files. The type of test    \n' +
'                       to execute is specified by the first sub target          \n' +
'                       (unit/api).                                              \n' +
'                                                                                \n' +
'   bump:[major|minor]: Updates the version number of the package. By default,   \n' +
'                       this task only increments the patch version number. Major\n' +
'                       and minor version numbers can be incremented by          \n' +
'                       specifying the "major" or "minor" subtask.               \n' +
'                                                                                \n' +
'   all               : Performs standard pre-checkin activities. Runs           \n' +
'                       formatting on all source files, validates the files      \n' +
'                       (linting), and executes tests against source code.       \n' +
'                       All temporary files/folders are cleaned up on task       \n' +
'                       completion.                                              \n' +
'                                                                                \n' +
' Supported Options:                                                             \n' +
'   --test-suite      : Can be used to specify a unit test suite to execute when \n' +
'                       running tests. Useful when development is focused on a   \n' +
'                       small section of the app, and there is no need to retest \n' +
'                       all components when runing a watch.                      \n' +
'                                                                                \n' +
' IMPORTANT: Please note that while the grunt file exposes tasks in addition to  \n' +
' ---------  the ones listed below (no private tasks in grunt yet :( ), it is    \n' +
'            strongly recommended that just the tasks listed below be used       \n' +
'            during the dev/build process.                                       \n' +
'                                                                                \n' +
'--------------------------------------------------------------------------------';

module.exports = function(grunt) {
    /* ------------------------------------------------------------------------
     * Initialization of dependencies.
     * ---------------------------------------------------------------------- */
    //Time the grunt process, so that we can understand time consumed per task.
    require('time-grunt')(grunt);

    //Load all grunt tasks by reading package.json. Ignore @vamshi/grunt-utils,
    //which is actually a utility library and not a grunt task.
    require('load-grunt-tasks')(grunt, {
        pattern: ['grunt-*', '@vamship/grunt-*', '!@vamship/grunt-utils']
    });

    /* ------------------------------------------------------------------------
     * Project structure and static parameters.
     * ---------------------------------------------------------------------- */
    const PROJECT = Directory.createTree('./', {
        src: null,
        test: {
            unit: null,
            api: null
        },
        working: {
            src: null,
            test: {
                unit: null,
                api: null
            }
        },
        dist: null,
        docs: null,
        node_modules: null,
        coverage: null
    });

    const packageConfig = grunt.file.readJSON('package.json') || {};

    PROJECT.appName = packageConfig.name || '__UNKNOWN__';
    PROJECT.version = packageConfig.version || '__UNKNOWN__';
    PROJECT.unscopedName = PROJECT.appName.replace(/^@[^/]*\//, '');

    // Shorthand references to key folders.
    const SRC = PROJECT.getChild('src');
    const TEST = PROJECT.getChild('test');
    const DOCS = PROJECT.getChild('docs');
    const WORKING = PROJECT.getChild('working');
    const DIST = PROJECT.getChild('dist');
    const NODE_MODULES = PROJECT.getChild('node_modules');
    const COVERAGE = PROJECT.getChild('coverage');

    // Constants - same for all projects.
    const AWS_S3_LAMBDA_DIR = `${PROJECT.appName}/lambda`;

    // Helper functions
    let _awsAccountId = null;
    const _getPackageName = () => {
        return `${PROJECT.appName}-${PROJECT.version.replace(/\./g, '_')}.zip`;
    };
    const _getAwsRegion = () => {
        return grunt.option('aws-region') || DEFAULT_AWS_REGION;
    };
    const _getAwsProfile = () => {
        return grunt.option('aws-profile') || DEFAULT_AWS_PROFILE;
    };
    const _getAwsS3Bucket = () => {
        return grunt.option('aws-s3-bucket') || DEFAULT_AWS_S3_BUCKET;
    };
    const _getAwsAccountId = () => {
        return new Promise((resolve, reject) => {
            const profile = _getAwsProfile();
            const iam = new _awsSdk.IAM({
                credentials: new _awsSdk.SharedIniFileCredentials({
                    profile
                })
            });

            if (_awsAccountId) {
                resolve(_awsAccountId);
            } else {
                iam.getUser((err, data) => {
                    if (err) {
                        grunt.log.error(
                            `Unable to extract AWS information for profile: [${profile}]`
                        );
                        reject(err);
                        return;
                    }
                    const accountId = data.User.Arn.split(':')[4];
                    _awsAccountId = accountId;
                    resolve(accountId);
                });
            }
        });
    };

    /* ------------------------------------------------------------------------
     * Grunt task configuration
     * ---------------------------------------------------------------------- */
    grunt.initConfig({
        /**
         * Configuration for grunt-contrib-copy, which is used to:
         * - Copy files from transpiled (working) to distribution targets
         */
        copy: {
            compile: {
                files: [
                    {
                        expand: true,
                        cwd: SRC.path,
                        src: ['**'],
                        dest: WORKING.path
                    },
                    {
                        expand: true,
                        cwd: PROJECT.path,
                        src: [`.${PROJECT.appName}rc`],
                        dest: WORKING.path
                    },
                    {
                        expand: false,
                        cwd: PROJECT.path,
                        src: ['package.json'],
                        dest: WORKING.path
                    }
                ]
            }
        },

        /**
         * Configuration for grunt-contrib-clean, which is used to:
         *  - Remove temporary files and folders.
         */
        clean: {
            coverage: [COVERAGE.path],
            dist: [DIST.path],
            working: [WORKING.path]
        },

        /**
         * Configuration for grunt-mocha-istanbul, which is used to:
         *  - Execute server side node.js tests, with code coverage
         */
        mocha_istanbul: {
            options: {
                reportFormats: ['text-summary', 'html'],
                reporter: 'spec',
                colors: true
            },
            unit: [TEST.getChild('unit').getAllFilesPattern('js')],
            api: [TEST.getChild('api').getAllFilesPattern('js')]
        },

        /**
         * Configuration for grunt-prettier, which is used to:
         *  - Format javascript source code
         */
        prettier: {
            files: {
                src: [
                    'README.md',
                    'Gruntfile.js',
                    SRC.getAllFilesPattern('js'),
                    TEST.getAllFilesPattern('js')
                ]
            }
        },

        /**
         * Configuration for grunt-eslint, which is used to:
         *  - Lint source and test files.
         */
        eslint: {
            dev: [
                'Gruntfile.js',
                SRC.getAllFilesPattern('js'),
                TEST.getAllFilesPattern('js')
            ]
        },

        /**
         * Configuration for grunt-jsdoc, which can be used to:
         *  - Generate code documentation.
         */
        jsdoc: {
            options: {
                destination: DOCS.path,
                template: NODE_MODULES.getFilePath('docdash')
            },
            src: ['package.json', 'README.md', SRC.getAllFilesPattern('js')]
        },

        /**
         * Configuration for grunt-contrib-watch, which is used to:
         *  - Monitor all source/test files and trigger actions when these
         *    files change.
         */
        watch: {
            allSources: {
                files: [SRC.getAllFilesPattern(), TEST.getAllFilesPattern()],
                tasks: []
            }
        },

        /**
         * Configuration for grunt-bump, which is used to:
         *  - Update the version number on package.json
         */
        bump: {
            options: {
                push: false
            }
        },

        /**
         * Configuration for lambda_package, which is a part of
         * grunt-aws-lamda. This task is used to:
         *  - Create a package for lambda deployment
         */
        lambda_package: {
            default: {
                options: {
                    base_folder: WORKING.path,
                    dist_folder: DIST.path,
                    include_version: true,
                    include_files: '**/*'
                }
            }
        },

        /**
         * Configuration for grunt-aws-s3, which is used to:
         *  - Upload resources to S3
         */
        aws_s3: {
            options: {
                awsProfile: _getAwsProfile(),
                bucket: _getAwsS3Bucket(),
                region: _getAwsRegion(),
                differential: true
            },
            uploadLambda: {
                action: 'upload',
                expand: true,
                cwd: DIST.path,
                src: _getPackageName(),
                dest: AWS_S3_LAMBDA_DIR
            }
        },

        /**
         * Configuration for grunt-deploy-lambda, which is used to:
         *  - Deploy lambda functions from a package uploaded to S3
         */
        deploy_lambda_from_s3: {
            default: {
                packagePath: DIST.getFilePath(_getPackageName()),
                bucket: _getAwsS3Bucket(),
                functionArn: '',
                lambdaConfigOptions: {},
                options: {
                    awsProfile: _getAwsProfile()
                }
            }
        }
    });

    /* ------------------------------------------------------------------------
     * Task registrations
     * ---------------------------------------------------------------------- */

    /**
     * Test task - executes lambda tests against code in dev only.
     */
    grunt.registerTask('test', 'Executes tests against sources', (target) => {
        target = target || 'unit';
        const validTasks = {
            unit: [`mocha_istanbul:${target}`],
            api: [`mocha_istanbul:${target}`]
        };

        const tasks = validTasks[target];
        if (['unit', 'api'].indexOf(target) >= 0) {
            let testSuite = grunt.option('test-suite');
            if (typeof testSuite === 'string' && testSuite.length > 0) {
                if (!testSuite.endsWith('.js')) {
                    grunt.log.warn('Adding .js suffix to test suite');
                    testSuite = testSuite + '.js';
                }
                const path = WORKING.getChild(`test/${target}`).getFilePath(
                    testSuite
                );
                grunt.log.writeln(`Running test suite: [${testSuite}]`);
                grunt.log.writeln(`Tests will be limited to: [${path}]`);
                grunt.config.set(`mocha_istanbul.${target}`, path);
            }
        }

        if (tasks) {
            grunt.task.run(tasks);
        } else {
            grunt.log.error(`Unrecognized test type: [${target}]`);
            grunt.log.warn('Type "grunt help" for help documentation');
        }
    });

    /**
     * Monitor task - track changes on different sources, and enable auto
     * execution of tests if requested.
     *  - If arguments are specified (see help) execute the necessary actions
     *    on changes.
     */
    grunt.registerTask(
        'monitor',
        'Monitors source files for changes, and performs tasks as necessary',
        (target) => {
            const validTasks = {
                docs: ['docs'],
                lint: ['lint'],
                unit: ['test:unit'],
                api: ['test:api']
            };

            const tasks = validTasks[target];

            if (tasks) {
                grunt.log.writeln(`Tasks to run on change: [${tasks}]`);
                grunt.config.set(`watch.allSources.tasks`, tasks);
                grunt.task.run(`watch:allSources`);
            } else {
                grunt.log.error('No valid tasks to execute on change');
                grunt.log.warn('Type "grunt help" for help documentation');
            }
        }
    );

    /**
     * Build task - performs a compilation on all source files
     *  - Copies all relevant files to the distribution directory
     */
    grunt.registerTask(
        'build',
        'Performs a full build of all source files, preparing it for packaging/publication',
        () => {
            //This function could potentially do more at a later stage,
            //for example generating credential files for deployment
            //with lambdas, etc.

            grunt.task.run('clean:dist');
            grunt.task.run('clean:working');
            grunt.task.run('copy:compile');
        }
    );

    /**
     * Lambda deploy task. This task requires that the lambdas be packaged and
     * uploaded to S3
     *  - Deploys all lambdas configured in lambda-config.json, with optional
     *    filtering.
     */
    grunt.registerTask(
        'deploy_lambdas',
        'Deploys all defined lambda functions in the project',
        function() {
            let functionNameFilter = grunt.option('lambda-function');
            if (
                typeof functionNameFilter !== 'string' ||
                functionNameFilter.length < 0
            ) {
                functionNameFilter = '.*';
            } else {
                grunt.log.writeln(
                    `Filtering lambdas using regex pattern: [${functionNameFilter}]`
                );
            }
            functionNameFilter = new RegExp(functionNameFilter);

            const done = this.async();
            _getAwsAccountId().then(
                (accountId) => {
                    grunt.log.writeln(`Deploying lambda functions`);
                    const arnPrefix = `arn:aws:lambda:${_getAwsRegion()}:${accountId}:function:`;

                    _lambdaConfig.lambdas.forEach((config) => {
                        if (!functionNameFilter.test(config.functionName)) {
                            grunt.log.debug(
                                `Skipping function: [${config.functionName}]`
                            );
                            return;
                        }
                        const taskName = config.functionName;

                        // Create a different task for each call, because the calls are
                        // asynchronous
                        grunt.config.set(
                            `deploy_lambda_from_s3.${taskName}.packagePath`,
                            `${AWS_S3_LAMBDA_DIR}/${_getPackageName()}`
                        );
                        grunt.config.set(
                            `deploy_lambda_from_s3.${taskName}.bucket`,
                            _getAwsS3Bucket()
                        );
                        grunt.config.set(
                            `deploy_lambda_from_s3.${taskName}.functionArn`,
                            `${arnPrefix}${config.functionName}`
                        );
                        grunt.config.set(
                            `deploy_lambda_from_s3.${taskName}.options.profile`,
                            _getAwsProfile()
                        );
                        grunt.task.run(`deploy_lambda_from_s3:${taskName}`);
                    });
                    done();
                },
                (error) => {
                    grunt.log.writeln('Error getting account id');
                    done(false);
                }
            );
        }
    );

    /**
     * Lint task - checks source and test files for linting errors.
     */
    grunt.registerTask('lint', ['eslint:dev']);

    /**
     * Formatter task - formats all source and test files.
     */
    grunt.registerTask('format', ['prettier']);

    /**
     * Documentation task - generates documentation for the project.
     */
    grunt.registerTask('docs', ['jsdoc']);

    /**
     * Create distribution package task. Creates a new distribution of the app,
     * ready for deployment.
     */
    grunt.registerTask('package', [
        'format',
        'lint',
        'build',
        'test:unit',
        'lambda_package',
        'clean:working'
    ]);

    /**
     * Deploy lambda functions to AWS
     */
    grunt.registerTask('publish', ['aws_s3:uploadLambda', 'deploy_lambdas']);

    /**
     * Pre check in task. Intended to be run prior to commiting/pushing code.
     * Performs the following actions:
     *  - Format files
     *  - Lint files
     *  - Test source code
     *  - Cleaning up temporary files
     */
    grunt.registerTask('all', [
        'clean',
        'format',
        'lint',
        'build',
        'test:unit',
        'test:api',
        'clean'
    ]);

    /**
     * Shows help information on how to use the Grunt tasks.
     */
    grunt.registerTask('help', 'Displays grunt help documentation', () => {
        grunt.log.writeln(HELP_TEXT);
    });

    /**
     * Default task. Shows help information.
     */
    grunt.registerTask('default', ['help']);
};
