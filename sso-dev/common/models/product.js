'use strict';

const utils = require('loopback/lib/utils');

module.exports = function(Product) {
    Product.defaultAlgoProduct = function(productId, cb) {
        cb = cb || utils.createPromiseCallback();
        var where = {
            productId: productId,
        };
        Product.app.models.AlgoProduct.findOne({
            where: where,
            order: "create_time ASC"
        }, function(err, product) {
            cb(err, product)
        });

        return cb.promise;
    };

    Product.remoteMethod(
        'defaultAlgoProduct', {
            description: '',
            accepts: {
                arg: 'productId',
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
                path: '/:productId/default_algo_product'
            },
        }
    );

    Product.domainProduct = function(host, cb) {
        cb = cb || utils.createPromiseCallback();
        var where = {
            host: host,
        };
        Product.findOne({
            where: where,
            order: "create_time ASC"
        }, function(err, product) {
            cb(err, product)
        });

        return cb.promise;
    };

    Product.remoteMethod(
        'domainProduct', {
            description: '',
            accepts: {
                arg: 'host',
                type: 'string',
                http: function(ctx) {
                    return ctx.req.headers.host;
                }
            },
            returns: {
                root: true,
                type: 'Object'
            },
            http: {
                verb: 'get',
                path: '/domain_product'
            },
        }
    );
};