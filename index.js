let dotenv = require('dotenv');
let botkit = require('botkit');
let commandLineArgs = require('command-line-args');
let localtunnel = require('localtunnel');

dotenv.config();

const CONVERSATION_STATUS_HELLO = 1;
const CONVERSATION_STATUS_OFERTAS = 2;
const CONVERSATION_STATUS_DIRECCION = 3;
const CONVERSATION_STATUS_PAGO = 4;
const CONVERSATION_STATUS_FEEDBACK = 5;
let conversations = {};

const ops = commandLineArgs([
      {
          alias: 'l',
          name: 'lt',
          args: 1,
          description: 'Use localtunnel.me to make your bot available on the web.',
          type: Boolean,
          defaultValue: false
      },
      {
          name: 'ltsubdomain',
          alias: 's',
          args: 1,
          description: 'Custom subdomain for the localtunnel.me URL. This option can only be used together with --lt.',
          type: String,
          defaultValue: null
      },
]);

let controller = botkit.facebookbot({
    debug: false,
    log: true,
    access_token: process.env.FACEBOOK_PAGE_TOKEN,
    verify_token: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
    app_secret: process.env.FACEBOOK_APP_SECRET,
    validate_requests: true,
    receive_via_postback: true,
});

let bot = controller.spawn({});

controller.setupWebserver(process.env.port || 3000, (err,webserver) => {
    controller.createWebhookEndpoints(controller.webserver, bot, () => {
        if(ops.lt) {
            var tunnel = localtunnel(process.env.port || 3000, {subdomain: ops.ltsubdomain}, function(err, tunnel) {
                if (err) {
                    console.log(err);
                    process.exit();
                }
                console.log('Your bot is available on the web at the following URL: ' + tunnel.url + '/facebook/receive');
            });

            tunnel.on('close', function() {
                console.log('Your bot is no longer available on the web at the localtunnnel.me URL.');
                process.exit();
            });
        }
    });
});

controller.hears(['hola','hello','hey'], 'message_received', (bot, message) => {
    bot.startConversation(message, (err, convo) => {
        convo.say('Hello, I am Cossy your Cosentino assistant.');
        convo.say({
            attachment: {
                'type':'template',
                'payload':{
                    'template_type':'button',
                    'text':'¿How can we help you?',
                    'buttons':[
                        {
                            'type':'postback',
                            'title':'See products',
                            'payload':'products'
                        },
                        {
                            'type':'postback',
                            'title':'My profile',
                            'payload':'profile'
                        },
                        {
                            'type':'postback',
                            'title':'Purchase product',
                            'payload':'purchase'
                        },
                        {
                            'type':'postback',
                            'title':'FAQ',
                            'payload':'faq'
                        }
                    ]
                }
            }
        });
    });
    conversations[message.channel] = {
        status: CONVERSATION_STATUS_HELLO,
        coordinates: undefined,
        items: []
    };
});








controller.hears(['products', 'product'], 'message_received', (bot, message) => {
    if(conversations[message.channel] && conversations[message.channel].status === CONVERSATION_STATUS_HELLO){
        bot.startConversation(message, (err, convo) => {
            convo.ask({
                attachment: {
                    'type':'template',
                    'payload':{
                        'template_type':'button',
                        'text':'Actualmente tenemos disponible las siguientes ofertas:',
                        'buttons':[
                            {
                                'type':'postback',
                                'title':'A: Silestone Marfil',
                                'payload':'A'
                            },
                            {
                                'type':'postback',
                                'title':'B: Dekton Zeus',
                                'payload':'B'
                            },
                            {
                                'type':'postback',
                                'title':'C: Sensa Cold',
                                'payload':'C'
                            }
                        ]
                    }
                }
            }, (response, convo2) => {
                conversations[message.channel].items.push(response.text);
                conversations[message.channel].status = CONVERSATION_STATUS_OFERTAS;
                convo.next();
            });
            convo.say('Muy buena elección!');
            convo.say('¿Where do you want to receive the product?');
            convo.ask({
                'text': 'Share location',
                'quick_replies': [
                    {
                        'content_type': 'location'
                    }
                ]
            }, (response, convo2) => {
            conversations[message.channel].status = CONVERSATION_STATUS_DIRECCION;
                conversations[message.channel].coordinates = response.attachments[0].payload.coordinates;
                convo.next();
            });
            convo.say({
                "attachment":{
                    "type":"template",
                    "payload":{
                        "template_type":"receipt",
                        "recipient_name":"David Riudor",
                        "order_number":"12345678902",
                        "currency":"EUR",
                        "payment_method":"Visa 2345",
                        "timestamp":"1428444852",
                        "elements":[
                                {
                                    "title":"Silestone Countertop",
                                    "subtitle":"The most awarded surface on the world",
                                    "quantity":1,
                                    "price":1800,
                                    "currency":"EUR",
                                    "image_url":"http://static.cosentino.com/dektonmulti/theme/files/images/natural-coleccion/aura-kitchen.jpg"
                                }
                        ],
                        "address":{
                            "street_1":"C/ Jordi Girona 1-3 Campus Diagonal Nord",
                            "street_2":"Edific C6 Espai Empren",
                            "city":"Barcelona",
                            "postal_code":"08034",
                            "state":"BCN",
                            "country":"ES"
                        },
                        "summary":{
                            "subtotal":1800,
                            "shipping_cost":75,
                            "total_tax":378,
                            "total_cost":2253
                        }
                    }
                }
            });
            conversations[message.channel].status = CONVERSATION_STATUS_PAGO;
        });
    }
});
