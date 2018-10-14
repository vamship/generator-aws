'use strict';

const _loggerProvider = require('@vamship/logger');
_loggerProvider.enableMock();

const _chai = require('chai');
_chai.use(require('sinon-chai'));
_chai.use(require('chai-as-promised'));
const expect = _chai.expect;

const { testValues: _testValues } = require('@vamship/test-utils');
const {
<%if (lambdaSchemaCreate) {-%>
    LambdaTestWrapper,
    InputValidator
<%} else {-%>
    LambdaTestWrapper
<%}-%>
} = require('@vamship/aws-test-utils');
const _rewire = require('rewire');

const _handlerName = '<%= lambdaHandlerName %>';
let _handler = null;

describe('[<%= lambdaHandlerName %>]', () => {
    function _createWrapper(event) {
        event = Object.assign(
            {
                user: {
                    firstName: _testValues.getString('firstName'),
                    lastName: _testValues.getString('lastName')
                }
            },
            event
        );
        return new LambdaTestWrapper(_handlerName, _handler, event);
    }

    beforeEach(() => {
        _handler = _rewire('../../../src/handlers/<%= lambdaHandlerFile %>');
    });

<%if (lambdaSchemaCreate) {-%>
    describe('[input validation]', () => {
        it('should fail execution if the event does not define a valid user object', () => {
            const wrapper = new LambdaTestWrapper(_handlerName, _handler);
            const validator = new InputValidator(wrapper);

            return validator.checkRequiredObject(
                'user',
                (wrapper, type, pattern) => {
                    expect(wrapper.invoke()).to.be.rejectedWith(type, pattern);
                }
            );
        });

        it('should fail execution if the user object does not define a valid firstName property', () => {
            const wrapper = new LambdaTestWrapper(_handlerName, _handler);
            wrapper.setEventProperty('user', {});

            const validator = new InputValidator(wrapper);

            return validator.checkRequiredString(
                'user.firstName',
                (wrapper, type, pattern) => {
                    expect(wrapper.invoke()).to.be.rejectedWith(type, pattern);
                }
            );
        });

        it('should fail execution if the user object does not define a valid lastName property', () => {
            const wrapper = new LambdaTestWrapper(_handlerName, _handler);
            wrapper.setEventProperty('user', {
                firstName: _testValues.getString('firstName')
            });

            const validator = new InputValidator(wrapper);

            return validator.checkRequiredString(
                'user.lastName',
                (wrapper, type, pattern) => {
                    expect(wrapper.invoke()).to.be.rejectedWith(type, pattern);
                }
            );
        });

        it('should fail execution if the user object defines a middleName property of the incorrect type', () => {
            const wrapper = new LambdaTestWrapper(_handlerName, _handler);
            wrapper.setEventProperty('user', {
                firstName: _testValues.getString('firstName'),
                lastName: _testValues.getString('lastName')
            });

            const validator = new InputValidator(wrapper);

            return validator.checkOptionalString(
                'user.middleName',
                (wrapper, type, pattern) => {
                    expect(wrapper.invoke()).to.be.rejectedWith(type, pattern);
                }
            );
        });
    });

<%} -%>
    describe('[execution]', () => {
        it('should complete execution with a success message', () => {
            const wrapper = _createWrapper();
            const expectedMessage =
                'Lambda function [<%= lambdaFunctionName %>] executed successfully';

            return expect(wrapper.invoke()).to.be.fulfilled.then((message) => {
                expect(message).to.equal(expectedMessage);
            });
        });
    });
});
