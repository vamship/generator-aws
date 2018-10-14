'use strict';
const Generator = require('yeoman-generator');
const _chalk = require('chalk');
const _yosay = require('yosay');

const _consts = require('../../utils/constants');
const _package = require('../../package.json');

module.exports = class extends Generator {
    /**
     * Gather basic project information.
     */
    gatherProjectInfo() {
        const generatorTitle = `${_consts.GENERATOR_NAME} v${_package.version}`;
        this.log(
            _yosay(`AWS Project Generators.\n${_chalk.red(generatorTitle)} `)
        );
        this.prompt([
            {
                type: 'list',
                name: 'templateType',
                message: 'What type of project do you want to create?',
                choices: [_consts.SUB_GEN_MICROSERVICE, _consts.SUB_GEN_LAMBDA],
                default: _consts.SUB_GEN_LAMBDA
            }
        ]).then((answers) => {
            this.log(answers.templateType);
            switch (answers.templateType) {
                case 'microservice':
                    this.composeWith(
                        `${_consts.GENERATOR_NAME}:${
                            _consts.SUB_GEN_MICROSERVICE
                        }`
                    );
                    break;
                case 'lambda':
                    this.composeWith(
                        `${_consts.GENERATOR_NAME}:${_consts.SUB_GEN_LAMBDA}`
                    );
                    break;
            }
        });
    }
};
