'use strict';

module.exports = function(admin) {
    //给admin分页查询的接口
    admin.pagelist = function(filter, page, start, limit, cb) {
        var where = {
            disable: 0
        };
        var filter_map = {
            order: ['create_time DESC'],
            limit: limit,
            offset: start,
        };
        if (filter) {
            var fils = filter.split('-');
            for (var i = fils.length; i--;) {
                var filters = fils[i].split('::');
                if (filters[1]) {
                    if (filters[0] === 'oid') {
                        where[filters[0]] = filters[1];
                    } else {
                        where[filters[0]] = {
                            like: '%' + filters[1] + '%'
                        };
                    }
                }
            }
        }
        filter_map['where'] = where;
        console.log("filter_map----",filter_map);
        admin.find(filter_map, function(err, record_results) {
            var result = {};
            result['data'] = record_results;
            admin.count(where, function(err, count_results) {
                result['total'] = count_results;
                return cb(err, result);
            });
        });

    };
    admin.remoteMethod('pagelist', {
        accepts: [{
            arg: 'filter',
            type: 'string'
        }, {
            arg: 'page',
            type: 'number'
        }, {
            arg: 'start',
            type: 'number'
        }, {
            arg: 'limit',
            type: 'number'
        }],
        http: {
            path: '/pagelist',
            verb: 'get'
        },
        returns: {
            root: true,
            type: 'Object'
        }
    });
}
