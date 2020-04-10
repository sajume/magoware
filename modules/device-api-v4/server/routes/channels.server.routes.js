'use strict'

const channelCtl = require('../controllers/channels.server.controller'),
      authMiddleware = require('../middlewares/auth.middleware.server.controller'),
      path = require('path'),
      winston = require('winston'),
      streamStore =require(path.resolve('./config/lib/stream_store'));

module.exports = function(app)  {
    //Load stream channel in redis
    streamStore.loadAllChannelStreams()
        .then(function() {
            winston.info('Channel streams loaded into Redis')
        })
        .catch(function(err) {
            winston.error(err);
        });
        
    app.route('/apiv4/channels/:id')
        .all(authMiddleware.requireToken)
        .get(channelCtl.getChannel);

    app.route('/apiv4/channels/:id/streams')
        .all(authMiddleware.requireToken)
        .get(channelCtl.getChannelStream);
}
