'use strict'

var path = require('path'),
    winston = require('winston'),
    response = require(path.resolve('./config/responses')),
    carousels = require(path.resolve('./config/defaultvalues/carousels.json')),
    db = require(path.resolve('./config/lib/sequelize')),
    models = db.models,
    schedule = require('./schedule.server.controller');

var carouselMap = {};

exports.getCarousels = function(req, res) {
    response.send_res(req, res, carousels, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
}

exports.getTrendingChannels = function(req, res) {
    let companyId = (req.headers.company_id) ? req.headers.company_id : 1
    let intervalStart = new Date(Date.now()); //get current time to compare with enddate
    let intervalEnd = new Date(Date.now());
    intervalEnd.setHours(intervalEnd.getHours() + 12);

    models.channels.findAll({
        attributes: ['id', 'channel_number', 'title'],
        where: {id: {$in: [1520, 465, 974, 541, 1053]}, company_id: companyId},
        include: [
            {
                model: models.epg_data,
                attributes: ['id', 'title', 'program_start', 'program_end', [db.sequelize.literal('(SELECT IFNULL((SELECT icon_url FROM program_content WHERE program_content.title=epg_data.title), "") AS "icon_url")'), 'icon_url']],
                required: false,
                where: {
                    program_start: {
                        $lte: intervalEnd
                    },
                    program_end: {
                        $and: [
                            {$lte: intervalEnd},
                            {$gte: intervalStart}
                        ]
                    }
                },
                //limit: 1
            }
        ]
    }).then(function(channels) {
        response.send_res(req, res, channels, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
    })

    /*let dummyChannels = [
        [
            {
                "id": 1520,
                "title": "Top Channel HD H1",
                "epg_data": [
                    {
                        "id": 4547786,
                        "title": "Portokalli",
                        "program_start": "2020-04-14T22:00:00.000Z",
                        "program_end": "2020-04-15T15:00:00.000Z",
                        "icon_url": "https://i.ytimg.com/vi/bEcI5sA0_yg/maxresdefault.jpg"
                    }
                ]
            },
            {
                "id": 465,
                "title": "Klan HD",
                "epg_data": [
                    {
                        "id": 4547786,
                        "title": "Cukur",
                        "program_start": "2020-04-14T22:00:00.000Z",
                        "program_end": "2020-04-15T15:00:00.000Z",
                        "icon_url": "https://tvklan.al/wp-content/uploads/2020/04/Cukur-234-2.jpg"
                    }
                ]
            },
            {
                "id": 974,
                "title": "Vizion plus",
                "epg_data": [
                    {
                        "id": 4547786,
                        "title": "Familja Kuqezi",
                        "program_start": "2020-04-14T22:00:00.000Z",
                        "program_end": "2020-04-15T15:00:00.000Z",
                        "icon_url": "https://www.vizionplus.tv/wp-content/uploads/2020/02/Familja-Kuqezi.gif"
                    }
                ]
            },
            {
                "id": 541,
                "title": "Nickelodeon",
                "epg_data": [
                    {
                        "id": 4547786,
                        "title": "Ride",
                        "program_start": "2020-04-14T22:00:00.000Z",
                        "program_end": "2020-04-15T15:00:00.000Z",
                        "icon_url": "https://m.media-amazon.com/images/M/MV5BNGMzZjE5YjEtN2I5YS00MzMzLWI2NDEtNjdkMGIzZTBhMGQ5XkEyXkFqcGdeQXVyNzI4NzczODE@._V1_UY1200_CR477,0,630,1200_AL_.jpg"
                    }
                ]
            },
            {
                "id": 1733,
                "title": "Nickelodeon",
                "epg_data": [
                    {
                        "id": 4547786,
                        "title": "Alien 3",
                        "program_start": "2020-04-14T22:00:00.000Z",
                        "program_end": "2020-04-15T15:00:00.000Z",
                        "icon_url": "https://hips.hearstapps.com/digitalspyuk.cdnds.net/16/17/1461667250-alien-3-ripley.jpg"
                    }
                ]
            }
        ]
    ];

    response.send_res(req, res, dummyChannels, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');*/
}

exports.getComingEpg = function(req, res) {
    let companyId = (req.headers.company_id) ? req.headers.company_id : 1
    let intervalStart = new Date(Date.now()); //get current time to compare with enddate
    let intervalEnd = new Date(Date.now());
    intervalEnd.setHours(intervalEnd.getHours() + 12);

    let epgOptions = {
        attributes: ['id', 'title', [db.sequelize.col('epg_data.long_description'), 'description'], 'program_start', 'program_end', [db.sequelize.literal('(SELECT IFNULL((SELECT icon_url FROM program_content WHERE program_content.title=epg_data.title), "") AS "icon_url")'), 'icon_url']],
        where: {
            program_start: {
                $gte: intervalStart
            },
            program_end: {
                $and: [
                    {$lte: intervalEnd},
                    {$gte: intervalStart}
                ]
            }
        },
        include: [
            {
                model: models.program_schedule,
                required: false, //left join
                attributes: ['id'],
                where: {login_id: req.thisuser.id}
              }
        ],
        limit: 1
    };

    models.channels.findAll({
        attributes: ['id', 'channel_number', 'title'],
        where: {id: {$in: [1520, 465, 974, 541, 1053]}, company_id: companyId},
    }).then(function(channels) {
        return getEpgForChannels(channels, epgOptions)
            .then(function() {
                response.send_res(req, res, channels, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
            }).catch(function(err) {
                winston.error('Getting list of next coming events failed with error: ', err);
                response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            });
    })

    /*let dummyChannels = [
        [
            {
                "id": 1520,
                "title": "Top Channel HD H1",
                "epg_data": [
                    {
                        "id": 4547786,
                        "title": "Portokalli",
                        "description": "Program humori",
                        "program_start": "2020-04-14T22:00:00.000Z",
                        "program_end": "2020-04-15T15:00:00.000Z",
                        "icon_url": "https://i.ytimg.com/vi/bEcI5sA0_yg/maxresdefault.jpg",
                        "scheduled": false
                    }
                ]
            },
            {
                "id": 465,
                "title": "Klan HD",
                "epg_data": [
                    {
                        "id": 4547786,
                        "title": "Cukur",
                        "description": "Serial turk",
                        "program_start": "2020-04-14T22:00:00.000Z",
                        "program_end": "2020-04-15T15:00:00.000Z",
                        "icon_url": "https://tvklan.al/wp-content/uploads/2020/04/Cukur-234-2.jpg",
                        "scheduled": true
                    }
                ]
            },
            {
                "id": 974,
                "title": "Vizion plus",
                "epg_data": [
                    {
                        "id": 4547786,
                        "title": "Familja Kuqezi",
                        "description": "Program familjar",
                        "program_start": "2020-04-14T22:00:00.000Z",
                        "program_end": "2020-04-15T15:00:00.000Z",
                        "icon_url": "https://www.vizionplus.tv/wp-content/uploads/2020/02/Familja-Kuqezi.gif",
                        "scheduled": false
                    }
                ]
            },
            {
                "id": 541,
                "title": "Nickelodeon",
                "epg_data": [
                    {
                        "id": 4547786,
                        "title": "Ride",
                        "description": "Programs of Nickelodeon",
                        "program_start": "2020-04-14T22:00:00.000Z",
                        "program_end": "2020-04-15T15:00:00.000Z",
                        "icon_url": "https://m.media-amazon.com/images/M/MV5BNGMzZjE5YjEtN2I5YS00MzMzLWI2NDEtNjdkMGIzZTBhMGQ5XkEyXkFqcGdeQXVyNzI4NzczODE@._V1_UY1200_CR477,0,630,1200_AL_.jpg",
                        "scheduled": false
                    }
                ]
            },
            {
                "id": 1733,
                "title": "Nickelodeon",
                "epg_data": [
                    {
                        "id": 4547786,
                        "title": "Alien 3",
                        "description": "Ellen Ripley's escape pod crash-lands on Fiorina 161, a penal colony planet terrorised by an alien. She rallies the inmates into killing it but realises that she is carrying an alien embryo herself.",
                        "program_start": "2020-04-14T22:00:00.000Z",
                        "program_end": "2020-04-15T15:00:00.000Z",
                        "icon_url": "https://hips.hearstapps.com/digitalspyuk.cdnds.net/16/17/1461667250-alien-3-ripley.jpg",
                        "scheduled": false
                    }
                ]
            }
        ]
    ];

    response.send_res(req, res, dummyChannels, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');*/
}

exports.getFeedChannels = function(req, res) {
    let channelFilter = {
        company_id: req.thisuser.company_id,
        isavailable: 1
    };

    if(req.thisuser.show_adult == 0) {
        channelFilter.pin_protected = 0;
    }

    let streamFilter = {};
    streamFilter.stream_source_id = req.thisuser.channel_stream_source_id; // streams come from the user's stream source
    streamFilter.stream_mode = 'live'; //filter streams based on device resolution
    streamFilter.stream_resolution = {$like: "%"+req.auth_obj.appid+"%"};

    models.package.findAll({
        attributes: ['id'],
        where: {package_type_id: req.auth_obj.screensize},
        include:[
            {model: models.subscription,
                required: true,
                attributes: [],
                where: {login_id: req.thisuser.id, end_date: {$gte: Date.now()}}
            }
        ]
    }).then(function(packagesWithSubscription) {
        let packages = [];
        for (let i = 0; i < packagesWithSubscription.length; i++) {
            packages.push(packagesWithSubscription[i].id);
        }

        return models.channels.findAll({
            raw:true,
            attributes: ['id', 'title', 'channel_number', [db.sequelize.fn('concat', req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('channels.icon_url')), 'icon_url']],
            where: channelFilter,
            include: [
                {
                    model: models.packages_channels,
                    required: true,
                    attributes:[],
                    where: {
                        package_id: {
                            $in: packages
                        }
                    }
                }
            ],
            group: ['id'],
            order: [[ 'channel_number', 'ASC' ]],
            limit: 10,
            subQuery: false,
        }).then(function(channels) {
            response.send_res(req, res, channels, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
        }).catch(function(err) {
            winston.error('Getting list of customer chanel failed with error: ' + err);
            response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
        });
    }).catch(function(err) {
        winston.error('Getting list of subscribed packages failed with error: ' + err);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
}

exports.getFeedMovies = function(req, res) {
    models.package.findAll({
        attributes: ['id'],
        where: {package_type_id: req.auth_obj.screensize + 2},
        include: [{
            model: models.subscription,
            required: true,
            attributes: ['id'],
            where: {login_id: req.thisuser.id, end_date: {$gte: Date.now()}}
        }]
    }).then(function(subscribedPackages) {
        let packages = [];

        for (let i = 0; i < subscribedPackages.length; i++) {
            packages.push(subscribedPackages[i].id);
        }

        let options = {
            attributes: ['id', 'title', [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('vod.icon_url')), 'poster_path']],
            where: {
                adult_content: false
            },
            include: [
                {
                    model: models.package_vod,
                    required: true,
                    attributes: [],
                    where: {
                        package_id: {
                            $in: packages
                        }
                    }
                }
            ],
            order: [['clicks', 'DESC']],
            limit: 10,
            subQuery: false
        }

        return models.vod.findAll(options)
            .then(function(vods) {
                response.send_res(req, res, vods, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
            }).catch(function(err) {
                winston.error('Getting list of vod failed with error: ', err);
                response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            });
    }).catch(function(err) {
        winston.error('Getting list of subscribed packages failed with error: ', err);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
}

exports.getFeedShows = function(req, res) {
    models.tv_series_packages.findAll({
        include: [
            {
                model: models.package,
                required: true,
                attributes: [],
                where: {package_type_id: req.auth_obj.screensize + 2},
                include: [{
                    model: models.subscription,
                    required: true,
                    attributes: [],
                    where: {login_id: req.thisuser.id, end_date: {$gte: Date.now()}}
                }]
            }
        ]
    }).then(function(subscribedPackages) {
        let packages = [];
        for (let i = 0; i < subscribedPackages.length; i++) {
            packages.push(subscribedPackages[i].id);
        }

        let options = {
            attributes : ['id', 'title', [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('tv_series.icon_url')), 'poster_path']],
            where: {
                company_id: req.thisuser.company_id,
                expiration_time: {
                    $gte: Date.now()
                }
            },
            include: [
                {
                    model: models.tv_season,
                    attributes: ['id', 'season_number', 'title'],
                    required: false,
                    where: {expiration_time: {$gte: Date.now()}, is_available: true}
                },
                {
                    model: models.tv_series_packages, 
                    required: true, 
                    attributes: [], 
                    where: {package_id: {$in: packages}}
                }
            ]
        }

        return models.tv_series.findAll(options)
            .then(function(tvSeries) {
                response.send_res(req, res, tvSeries, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'private,max-age=86400');
            }).catch(function(err) {
                winston.error('Getting list of series failed with error: ', err);
                response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            })
    }).catch(function(err) {
        winston.error('Getting list of subscribed packages failed with error: ', err);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
}

exports.getNewArrivals = function(req, res) {
    models.package.findAll({
        attributes: ['id'],
        where: {package_type_id: req.auth_obj.screensize + 2},
        include: [{
            model: models.subscription,
            required: true,
            attributes: ['id'],
            where: {login_id: req.thisuser.id, end_date: {$gte: Date.now()}}
        }]
    }).then(function(subscribedPackages) {
        let packages = [];

        for (let i = 0; i < subscribedPackages.length; i++) {
            packages.push(subscribedPackages[i].id);
        }

        let options = {
            attributes: ['id', 'title', 'release_date', [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('vod.image_url')), 'backdrop_path'],
            [db.sequelize.literal('(SELECT IFNULL((SELECT favorite FROM vod_resume WHERE login_id=' + req.thisuser.id + ' AND vod_id=vod.id), 0) AS "icon_url")'), 'watched']],
            where: {
                adult_content: false
            },
            include: [
                {
                    model: models.package_vod,
                    required: true,
                    attributes: [],
                    where: {
                        package_id: {
                            $in: packages
                        }
                    }
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 10,
            subQuery: false
        }

        return models.vod.findAll(options)
            .then(function(vods) {
                response.send_res(req, res, vods, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
            }).catch(function(err) {
                winston.error('Getting list of vod failed with error: ', err);
                response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            });
    }).catch(function(err) {
        winston.error('Getting list of subscribed packages failed with error: ', err);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
}

exports.getFeedPausedMovies = function(req, res) {
    models.package.findAll({
        attributes: ['id'],
        where: {package_type_id: req.auth_obj.screensize + 2},
        include: [{
            model: models.subscription,
            required: true,
            attributes: ['id'],
            where: {login_id: req.thisuser.id, end_date: {$gte: Date.now()}}
        }]
    }).then(function(subscribedPackages) {
        let packages = [];

        for (let i = 0; i < subscribedPackages.length; i++) {
            packages.push(subscribedPackages[i].id);
        }

        let options = {
            attributes: ['id', 'title', [db.sequelize.fn("concat", req.app.locals.backendsettings[req.thisuser.company_id].assets_url, db.sequelize.col('vod.image_url')), 'backdrop_path'], [db.sequelize.col('vod_resumes.resume_position'), 'resume_position'], [db.sequelize.col('vod_resumes.percentage_position'), 'percentage_position']],
            where: {
                adult_content: false
            },
            include: [
                {
                    model: models.package_vod,
                    required: true,
                    attributes: [],
                    where: {
                        package_id: {
                            $in: packages
                        }
                    }
                },
                {
                    model: models.vod_resume,
                    required: true,
                    attributes: [],
                    where: {
                        login_id: req.thisuser.id,
                        resume_position: {
                            $gt: 0
                        },
                        percentage_position: {
                            $lt: 90
                        }
                    }
                }
            ],
            order: db.sequelize.literal('vod_resumes.updatedAt DESC'),
            limit: 10,
            subQuery: false
        }

        return models.vod.findAll(options)
            .then(function(vods) {
                response.send_res(req, res, vods, 200, 1, 'OK_DESCRIPTION', 'OK_DATA', 'no-store');
            }).catch(function(err) {
                winston.error('Getting list of vod failed with error: ', err);
                response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
            });
    }).catch(function(err) {
        winston.error('Getting list of subscribed packages failed with error: ', err);
        response.send_res(req, res, [], 706, -1, 'DATABASE_ERROR_DESCRIPTION', 'DATABASE_ERROR_DATA', 'no-store');
    });
}

function getEpgForChannels(channels, epgOptions) {
    let promiseArr = [];
    for (let i = 0; i < channels.length; i++) {
        channels[i] = channels[i].toJSON();
        promiseArr.push(getEpgForChannel(channels[i], epgOptions));
    }

    return Promise.all(promiseArr);
}

function getEpgForChannel(channel, options) {
    if (!options.where) {
        options.where = {};
    }

    options.where.channels_id = channel.id;

    return new Promise(function(resolve, reject) {
        models.epg_data.findAll(options)
            .then(function(epgs) {
                for (let i = 0; i < epgs.length; i++) {
                    let epg = epgs[i].toJSON();
                    epg.scheduled = epg.program_schedules.length > 0 ? schedule.is_scheduled(epg.program_schedules[0].id) : false;
                    delete epg.program_schedules;
                    epgs[i] = epg;
                }
                
                channel.epg_data = epgs;
                resolve();
            })
            .catch(function(err) {
                reject(err);
            });
    });
}

function indexCarouselByType() {
    for (let i = 0; i < carousels.length; i++) {
        let carousel = carousels[i];
        carouselMap[carousel.type] = carousel;
    }
}

indexCarouselByType();