'use strict';

module.exports = function(UserBase) {

    // UserBase.accountStatus = function(uid, params, cb) {
    //     cb = cb || utils.createPromiseCallback();

    //     UserBase.findOne({
    //         where: {
    //             uid: uid
    //         },
    //         order: "create_time DESC"
    //     }, function(err, user) {
    //         if (err) return cb(err);
    //         if (!user) {
    //             const err = new Error('Could not find the model');
    //             err.statusCode = 404;
    //             err.code = 'USER_NOT_FOUND';
    //             return cb(err);
    //         }
    //         user.accountStatus = params.status

    //         user.save(function(err) {
    //             if (err) {
    //                 cb(err);
    //             } else {
    //                 cb(null, {status: params.status});
    //             }
    //         });
    //     });

    //     return cb.promise;
    // };

    // UserBase.remoteMethod(
    //     'accountStatus', {
    //         description: 'init all.',
    //         accepts: [{
    //             arg: 'uid',
    //             type: 'string',
    //             'http': {
    //                 source: 'path'
    //             }
    //         }, {
    //             arg: 'params',
    //             type: 'object',
    //             required: true,
    //             http: {
    //                 source: 'body'
    //             }
    //         }],
    //         returns: {
    //             root: true,
    //             type: 'Object'
    //         },
    //         http: {
    //             verb: 'patch',
    //             path: '/:uid/account_status'
    //         },
    //     }
    // );
};
