'use strict';

const socketIO = require('socket.io');
const AliMNS = require('ali-mns');
const crypto = require('crypto');
const util = require('util');
const aliAcc = new AliMNS.Account(
    '1075072801473341',
    'LTAI4z9qMLFKlRK3',
    'O92b38RZsr0joyarDVnHC3NmE8pHbZ'
);

let region = new AliMNS.Region('shanghai');

function generateQueueEndpoint(region, accountId, queueName) {
    return util.format("acs:mns:%s:%s:queues/%s", region, accountId, queueName);
}

module.exports = function notiServer(app) {
    // enable authentication
    // app.io = socketIO.listen(5050, {
    //     path: '/getPush'
    // });
    // app.io.on('connection', function(socket){
    //     console.log('user connected');
    //     app.io.emit('data', 'test');
    //     // app.io.emit('datadsd', 'test');
    //     let tagFilter = null;
    //     let topicName = null;
    //     // console.log('handshake',socket.handshake,socket.handshake.query)
    //     if(socket.handshake.query && socket.handshake.query.oid) {
    //         tagFilter = util.format('oid.%s', socket.handshake.query.oid);
    //         topicName = util.format('%s-noti-org', process.env.env);
    //     } else if(socket.handshake.query && socket.handshake.query.uid) {
    //         tagFilter = util.format('uid.%s', socket.handshake.query.uid);
    //         topicName = util.format('%s-noti-user', process.env.env);
    //     } else {
    //         return;
    //     }
    //     let requestId =crypto.randomBytes(32).toString('hex');
    //     let qName = util.format('%s-noti-q-%s', process.env.env,requestId);
    //     let sName = util.format('%s-noti-sub-%s', process.env.env,requestId);
    //     let mns = new AliMNS.MNS(aliAcc, region);
    //     let topic = new AliMNS.Topic(topicName, aliAcc, region);
    //     let mq = null;
    //     mns.createP(qName).then(() => {
    //         mq = new AliMNS.MQ(qName, aliAcc, region);
    //         mq.notifyRecv((err, resp) => {
    //             if (err) {
    //                 console.error(err);
    //                 return;
    //             }
    //             let rawBody = resp.Message.MessageBody;
    //             console.log('rowbody',rawBody);
    //             socket.emit('data', JSON.parse(rawBody));
    //             mq.deleteP(resp.Message.ReceiptHandle);
    //         });
    //         topic.subscribeP(
    //             sName,
    //             generateQueueEndpoint(region, aliAcc.getAccountId(), qName),
    //             AliMNS.Subscription.NotifyStrategy.BACKOFF_RETRY,
    //             AliMNS.Subscription.NotifyContentFormat.SIMPLIFIED,
    //             tagFilter
    //         ).then(console.log, console.error);
    //         // topic.publishP(JSON.stringify({msg:'login',code:440}), true, 'uid.100000379').then(console.log, console.error);
    //     }, console.error);

    //     socket.on('disconnect', function(){
    //         mq.notifyStopP();
    //         mns.deleteP(qName);
    //         topic.unsubscribeP(sName);
    //         console.log('user disconnected');
    //     })
    // });
};
