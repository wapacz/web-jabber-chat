/*
 * @Description: It is XMPP chat plugin for jQuery. Using Strophe.
 * @Author: Michal Lapacz
 * @Date: 21.01.2013
 */
(function ($) {
    var Chat = {
        defaultOptions: {
            bosh_service : "http://www.lapacz.com.pl/http-bind/"
        },
        connection : null,
        header_min_text : null,
        header_max_text : null,
        container_max : null,
        container_chat : null,
        container_login : null,
        init : function(options) {
            
            var options = $.extend(Chat.defaultOptions, options);
            
            // max part
            var $container_max = $('<div>').addClass('chat-container-max ui-widget-content');
            Chat.container_max = $container_max;
            
            /*
            // add resizable handlers
            $container_max.append($('<div>').attr('id', 'handle-n').addClass('ui-resizable-handle ui-resizable-n'));
            $container_max.append($('<div>').attr('id', 'handle-w').addClass('ui-resizable-handle ui-resizable-w'));
            $container_max.append($('<div>').attr('id', 'handle-nw').addClass('ui-resizable-handle ui-resizable-nw'));
            
            $container_max.resizable({
                handles : {
                    'n'  : '#handle-n',
                    'w'  : '#handle-w',
                    'nw' : '#handle-nw'
                },
                minWidth : 162,
                minHeight : 110,
                //maxWidth : 700,
                //maxHeight : 500,
                distance : 30
            });
            */
            
            var $header_max = $('<div>').addClass('chat-header-max');
            $container_max.append($header_max);
            
            $icon_bar = $('<div>').addClass('icon-bar')
                .click(function () {
                    $container_max.hide();
                    $container_min.show();
                });
            $header_max.append($icon_bar);
            
            var $text_bar = $('<div>').addClass('text-bar').text('Niezalogowany');
            $header_max.append($text_bar);
            Chat.header_max_text = $text_bar;
            
            var $icon_close = $('<span>')
                .addClass('ui-icon ui-icon-close');
            $icon_bar.append($icon_close);
            
            var $container_login = $('<div>').addClass('chat-container-login');
            Chat.container_login = $container_login;
            $container_max.append($container_login);
            
            var $container_chat = $('<div>').addClass('chat-container-chat').hide();
            $container_chat.append($('<input>').addClass('ui-widget-content').attr({
                                    'id' : 'msg',
                                    'type' : 'text'
                                }));
            $container_chat.append($('<input>').attr({
                                    'type':'button',
                                    'value': 'Wyślij'
                                }).button().click(function () {
                                    Chat.sendMessage($('#msg').get(0).value);
                                    $('#msg').get(0).value = "";
                                }));
            Chat.container_chat = $container_chat;
            $container_max.append($container_chat);
            
            this.append($container_max);
            
            if (Chat.connection == null) {
                $input_jid = $('<input>').addClass('ui-widget-content').attr({
                                    'id' : 'jid',
                                    'type' : 'text'
                                });
                $input_pass = $('<input>').addClass('ui-widget-content').attr({
                                    'id' : 'pass',
                                    'type' : 'password'
                                });
                $input_button = $('<input>').attr({
                                    'type':'button',
                                    'value': 'Połącz'
                                }).button().click(function () {
                                    Chat.connection = new Strophe.Connection(options.bosh_service);
                                    Chat.connection.rawInput = Chat.rawInput;
                                    Chat.connection.rawOutput = Chat.rawOutput;
                                    Chat.connection.connect(
                                        $input_jid.get(0).value,
                                        $input_pass.get(0).value,
                                        Chat.onConnect
                                    );
                                });
                //$container_login.append($('<div>').css({'width': '30px', 'height': '15px', 'margin' : '6px'}).text('Login'));                
                $container_login.append($input_jid.css({'display':'block','width': '150px', 'height': '15px', 'margin' : '2px'}));
                //$container_login.append($('<div>').css({'float':'right', 'width': '30px', 'height': '15px', 'margin' : '6px'}).text('Hasło'));
                $container_login.append($input_pass.css({'display':'block','width': '150px', 'height': '15px', 'margin' : '2px'}));
                $container_login.append($input_button.css({'display':'block','width': '152px', 'height': '27px', 'margin' : '2px'}));
            }
            
            // min part
            var $container_min = $('<div>').hide();
            $container_min.addClass('chat-container-min ui-widget-content');
            
            var $header_min = $('<div>')
                .addClass('chat-header-min ui-widget-header')
                .click(function () {
                    $container_min.hide();
                    $container_max.show();
                })
                .text('Niezalogowany');
            $container_min.append($header_min);
            Chat.header_min_text = $header_min;
            
            this.addClass('ui-widget chat-container');
            this.append($container_min);
        },
        setHeaderText : function (text) {
            Chat.header_min_text.text(text);
            Chat.header_max_text.text(text);
        },
        log : function (msg) {
            $('#log').append('<div></div>').append(document.createTextNode(msg));
        },
        rawInput : function (data) {
            Chat.log('RECV: ' + data);
        },
        rawOutput : function (data) {
            Chat.log('SENT: ' + data);
        },
        onConnect : function (status) {
            if (status == Strophe.Status.CONNECTING) {
                Chat.log('Strophe is connecting.');
                Chat.setHeaderText("Logowanie...");
            } else if (status == Strophe.Status.CONNFAIL) {
                Chat.log('Strophe failed to connect.');
                Chat.setHeaderText("Niezalogowany");
            } else if (status == Strophe.Status.DISCONNECTING) {
                Chat.log('Strophe is disconnecting.');
                Chat.setHeaderText("Niezalogowany");
            } else if (status == Strophe.Status.DISCONNECTED) {
                Chat.log('Strophe is disconnected.');
                Chat.setHeaderText("Niezalogowany");
            } else if (status == Strophe.Status.AUTHENTICATING) {
                Chat.log('Strophe is AUTHENTICATING.');
                Chat.setHeaderText("Logowanie...");
            } else if (status == Strophe.Status.AUTHFAIL) {
                Chat.log('User not autenticated.');
                Chat.setHeaderText("Niezalogowany");
            } else if (status == Strophe.Status.CONNECTED) {
                Chat.log('Strophe is connected.');
                //Chat.connection.disconnect();
                Chat.setHeaderText("Zalogowany");
                
                
                Chat.container_max.css({
                    'width' : '500px',
                    'height' : '500px'
                });
                
                Chat.container_login.hide();
                
                Chat.container_chat.show();
                
                //Strophe.log = function (level, msg) {
                //  Chat.log('['+level+']: '+msg);
                //};
                
                Chat.connection.addHandler(Chat.onMessage, null, 'message', null, null,  null); 
                Chat.connection.send($pres().tree());
            } else if (status == Strophe.Status.ATTACHED) {
                Chat.log('Attached');
            }
        },
        onMessage : function (msg) {
            var to = msg.getAttribute('to');
            var from = msg.getAttribute('from');
            var type = msg.getAttribute('type');
            var elems = msg.getElementsByTagName('body');

            if (type == "chat" && elems.length > 0) {
                var body = elems[0];

                Chat.log('ECHOBOT: I got a message from ' + from + ': ' + 
                    Strophe.getText(body));
                
                //var reply = $msg({to: from, from: to, type: 'chat'})
                //        .cnode(Strophe.copyElement(body));
                //Chat.connection.send(reply.tree());

                //Chat.log('ECHOBOT: I sent ' + from + ': ' + Strophe.getText(body));
            }

            // we must return true to keep the handler alive.  
            // returning false would remove it after it finishes.
            return true;
        },
        sendMessage : function (msg) {
            if (Chat.connection.connected && Chat.connection.authenticated) {
                //var text = $('#' + elemid).get(0).value;
                if (msg.length > 0) {
                    //var from = Strophe.getNodeFromJid(Chat.connection.jid);
                    //var to = 'user2@big';
                    var reply = $msg({
                            to : 'user2@fobos',
                            from : Chat.connection.jid,
                            type : "chat"
                        }).c("body").t(msg);
                    
                    Chat.connection.send(reply.tree());
                    Chat.log(msg, "from");
                    
                    //$('#' + elemid).get(0).value = "";
                }
            } else {
                Chat.log("You have to log in before you can send msg");
            }
        }
    };
    
    $.fn.chat = function (method, options) {
        /***** Method resolving *****/
        if (Chat[method]) {
            return Chat[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return Chat.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist in jQuery.chat');
        }
    };
})(jQuery);