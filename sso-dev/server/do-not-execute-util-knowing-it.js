const server = require('./server');

setTimeout(() => {
    const ds = server.dataSources.mydb;
    const lbTables = ['InvitedUser'];
    ds.autoupdate(lbTables, function(er) {
    // ds.automigrate(lbTables, function(er) {
        if (er) throw er;
        console.log('Loopback tables [' - lbTables - '] created in ', ds.adapter.name);
        ds.disconnect();
    });
}, 5000);
