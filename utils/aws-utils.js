'use strict';

const { Promise } = require('bluebird');
const _fs = require('fs');
const _path = require('path');
const _os = require('os');
const _ini = require('ini');
const _awsSdk = require('aws-sdk');

let _listProfilesPromise = null;
let _listRegionPromise = null;

module.exports = {
    /**
     * Helper function that lists all defined aws profiles from the current users
     * ~/.aws/credentials file. If the config file is not found, or an error occurs
     * when reading the file, an empty list will be returned, and no errors will be
     * thrown.
     *
     * @param {...String} extras Extra options to be appended to the returned list
     * @return {Promise} A promise that will always be resolved - either with a list
     *         of valid profiles, or with an empty list (in case of an error).
     */
    getProfileList: (...extras) => {
        if (!_listProfilesPromise) {
            _listProfilesPromise = new Promise((resolve, reject) => {
                const credentialsFile = _path.resolve(
                    _os.homedir(),
                    '.aws',
                    'credentials'
                );
                _fs.readFile(credentialsFile, (err, data) => {
                    if (err) {
                        resolve([]);
                        return;
                    }
                    try {
                        const config = _ini.parse(data.toString());
                        resolve(Object.keys(config));
                    } catch (err) {
                        resolve([]);
                    }
                });
            }).then((list) => {
                return list.concat(extras);
            });
        }
        return _listProfilesPromise;
    },

    /**
     * Helper function that lists all regions for the currently selected profile.
     * If an error occurs when getting the region list, an empty list will be
     * returned, and no errors will be thrown.
     *
     * A default selection value will be appended to all lists - empty or otherwise.
     *
     * @param {String} profile The name of the AWS profile to use to authenticate
     *        with AWS
     * @param {...String} extras Extra options to be appended to the returned list
     * @return {Promise} A promise that will always be resolved - either with a list
     *         of valid regions, or a list with just a default selection.
     */
    getRegionList: (profile, ...extras) => {
        if (!_listRegionPromise) {
            _listRegionPromise = new Promise((resolve, reject) => {
                _awsSdk.config.credentials = new _awsSdk.SharedIniFileCredentials(
                    {
                        profile
                    }
                );
                // Default region to us-east-1. We don't really care about the
                // region here. This is a bit hacky, but will have to do for now.
                _awsSdk.config.update({
                    region: 'us-east-1'
                });
                const ec2 = new _awsSdk.EC2();
                ec2.describeRegions({}, (err, data) => {
                    if (err) {
                        resolve([]);
                        return;
                    }
                    try {
                        resolve(data.Regions.map((item) => item.RegionName));
                    } catch (err) {
                        resolve([]);
                    }
                });
            }).then((list) => {
                return list.concat(extras);
            });
        }
        return _listRegionPromise;
    },

    /**
     * Checks if a given S3 bucket exists, and returns a promise that will be
     * resolved with a true/false based on whether or not the bucket exists.
     *
     * @param {String} bucket The name of the S3 bucket to check
     * @param {String} profile The AWS profile to use
     * @return {Promise} A promise that will be resolved with true/false based on
     *         whether or not the bucket exists.
     */
    checkBucketExists: (bucket, profile) => {
        return new Promise((resolve, reject) => {
            _awsSdk.config.credentials = new _awsSdk.SharedIniFileCredentials({
                profile
            });
            const s3Client = new _awsSdk.S3();
            s3Client.headBucket({ Bucket: bucket }, (err, data) => {
                if (err) {
                    resolve(false);
                    return;
                }
                resolve(true);
            });
        });
    },

    /**
     * Creates a bucket in AWS S3 using the specifed aws profile.
     *
     * @param {String} bucket The name of the S3 bucket to check
     * @param {String} profile The AWS profile to use
     * @return {Promise} A promise that will be resolved/rejected based on the
     *         outcome of the create bucket operation.
     */
    createS3Bucket: (bucket, profile) => {
        return new Promise((resolve, reject) => {
            _awsSdk.config.credentials = new _awsSdk.SharedIniFileCredentials({
                profile
            });
            const s3Client = new _awsSdk.S3();
            s3Client.createBucket({ Bucket: bucket }, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ bucket: data.Location });
            });
        });
    }
};
