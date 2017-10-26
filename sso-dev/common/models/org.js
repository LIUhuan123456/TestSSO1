'use strict';

const utils = require('loopback/lib/utils');
const g = require('loopback/lib/globalize');

module.exports = function(Org) {
    Org.defaultProduct = function(oid, cb) {
        cb = cb || utils.createPromiseCallback();
        var where = {
            oid: oid,
        };
        Org.app.models.Product.findOne({
            where: where,
            order: "create_time ASC"
        }, function(err, product) {
            cb(err, product)
        });

        return cb.promise;
    };

    Org.remoteMethod(
        'defaultProduct', {
            description: '',
            accepts: {
                arg: 'oid',
                type: 'string',
                'http': {
                    source: 'path'
                }
            },
            returns: {
                root: true,
                type: 'Object'
            },
            http: {
                verb: 'get',
                path: '/:oid/default_product'
            },
        }
    );

    Org.defaultAlgoProduct = function(oid, cb) {
        cb = cb || utils.createPromiseCallback();
        var where = {
            oid: oid,
        };
        Org.app.models.AlgoProduct.findOne({
            where: where,
            order: "create_time ASC"
        }, function(err, product) {
            cb(err, product)
        });

        return cb.promise;
    };

    Org.remoteMethod(
        'defaultAlgoProduct', {
            description: '',
            accepts: {
                arg: 'oid',
                type: 'string',
                'http': {
                    source: 'path'
                }
            },
            returns: {
                root: true,
                type: 'Object'
            },
            http: {
                verb: 'get',
                path: '/:oid/default_algo_product'
            },
        }
    );
};
