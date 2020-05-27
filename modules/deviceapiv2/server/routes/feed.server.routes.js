'strict'

var feedCtl = require('../controllers/feed.server.controller'),
    policy = require('../auth/apiv2.server.auth');

module.exports = function(app) {
    app.route('/apiv3/feeds/carousels')
        .get(feedCtl.getCarousels)
        
    app.route('/apiv3/feeds/tv/trending')
       .get(feedCtl.getTrendingChannels)

    app.route('/apiv3/feeds/tv/coming')
        .all(policy.isAllowed)
        .get(feedCtl.getComingEpg);

    app.route('/apiv3/feeds/tv/channels')
        .all(policy.isAllowed)
        .get(feedCtl.getFeedChannels);

    app.route('/apiv3/feeds/movies')
        .all(policy.isAllowed)
        .get(feedCtl.getFeedMovies);

    app.route('/apiv3/feeds/shows')
        .all(policy.isAllowed)
        .get(feedCtl.getFeedShows);

    app.route('/apiv3/feeds/movies/new')
        .all(policy.isAllowed)
        .get(feedCtl.getNewArrivals);

    app.route('/apiv3/feeds/movies/paused')
        .all(policy.isAllowed)
        .get(feedCtl.getFeedPausedMovies);
}