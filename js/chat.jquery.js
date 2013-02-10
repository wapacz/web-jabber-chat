/*
 * @Description: It is XMPP chat plugin for jQuery. Using Strophe and MUC Strophe plugin.
 * @Author: Michal Lapacz
 * @Date: 21.01.2013
 */
(function ($) {
    var Chat = {
        /*
         * Default options
         */
        options: {
            bosh_service : 'http-bind/',
            domain: '',
            resource: 'sharpchat',
            dataUrl: 'data/json.php',
            onSuccess: null,
            onError: null
        },
        container : null, // whole chat container handle
        connection : null, // XMPP connection handle
        user : null, // user credentials
        contacts : [], // list of contacts
        selectedContacts : [], // list of user contacts
        success_cb : null, // callback function for success
        error_cb : null, // callback function for failure
        
        /*
         * Initialize chat
         */
        init : function(options) {
            
            // Strophe.log = function (level, msg) {
              // Chat.log('['+level+']: '+msg);
            // }
            
            Chat.container = this;
            Chat.container.addClass('chat-container');
            Chat.container.append(Chat.createMainGui());
            Chat.minimize();
            
            Chat.connection = new Strophe.Connection(Chat.options.bosh_service);
            Chat.connection.muc.init(Chat.connection); // initialize MUC plugin
            
            Chat.success_cb = Chat.options.onSuccess;
            Chat.error_cb = Chat.options.onError;
        },
        
        log : function (msg) {
            
            var log = $('#log');
            log.append('<div>').append(document.createTextNode(msg));
            log.scrollTop(log[0].scrollHeight - log.height());
        },
        
        rawInput : function (data) {
            Chat.log('IN >>> ' + data);
        },
        
        rawOutput : function (data) {
            Chat.log('OUT <<< ' + data);
        },
        
        login : function (login) {
            
            Chat.user = {
                jid : Chat.options.login+'@'+Chat.options.domain,
                full_jid: Chat.options.login+'@'+Chat.options.domain+'/'+Chat.options.resource,
                username : Chat.options.login,
                password : Chat.options.password
            };
            
            // Chat.connection.rawInput = Chat.rawInput;
            // Chat.connection.rawOutput = Chat.rawOutput;
            Chat.connection.connect(
                Chat.user.full_jid,
                Chat.user.password,
                Chat.onConnect
            );
        },
        
        logout : function () {
            Chat.connection.disconnect();
        },
        
        onConnect : function (status) {
            
            switch (status) {
                case Strophe.Status.CONNECTING:
                case Strophe.Status.AUTHENTICATING:
                    Chat.headerText.html('Logowanie...');
                    Chat.userIcon.addClass('chat-list-user-notactive');
                    Chat.userIcon.removeClass('chat-list-user-active');
                    break;
                    
                    
                case Strophe.Status.CONNECTED:
                case Strophe.Status.ATTACHED:
                    Chat.success_cb('Zalogowano do chata');
                    Chat.headerText.html('Zalogowany <strong>'+Chat.user.username+'</strong>');
                    Chat.userIcon.removeClass('chat-list-user-notactive');
                    Chat.userIcon.addClass('chat-list-user-active');
                    Chat.clearUserList();
                    // adding users to gui list
                    $.ajax({
                        dataType : "json",
                        url : Chat.options.dataUrl,
                        data : {'action' : 'get', 'contacts' : Chat.user.username},
                        success : function(users) {
                            Chat.onUsersFetched(users);
                        }
                    });
                    
                    Chat.connection.addHandler(Chat.onPresenceSubscriptionRequest, null, 'presence', 'subscribe');
                    Chat.connection.addHandler(Chat.onPresence, null, 'presence');
                    Chat.connection.addHandler(Chat.onMessage, null, 'message', null, null,  null); 
                    Chat.connection.addHandler(Chat.onConferenceRequest, 'jabber:x:conference' , 'message', null, null, null); 
                    
                    Chat.connection.send($pres().tree());
                    break;
                    
                    break;
                
                case Strophe.Status.CONNFAIL:
                case Strophe.Status.AUTHFAIL:
                    Chat.error_cb('Wystąpił problem z logowaniem do chata');
                case Strophe.Status.DISCONNECTING:
                case Strophe.Status.DISCONNECTED:
                default:
                    Chat.headerText.html('Niedostępny');
                    Chat.userIcon.addClass('chat-list-user-notactive');
                    Chat.userIcon.removeClass('chat-list-user-active');
                    Chat.clearUserList();
            
                    // hide all chat boxes
                    for(var i=0; i<Chat.chatBoxes.length; i++) {
                        var chatBox = Chat.chatBoxes[i];
                        chatBox.Minimize();
                        chatBox.Get$().hide();
                    }
                    break;
            }
        },
        
        onUsersFetched : function(contacts) {
        
            Chat.contacts = $(contacts).sort(function(a,b) {
                                            return a.username.toLowerCase() > b.username.toLowerCase() ? 1 : -1;  
                                        });
                        
            //self.chatListUsersList.clear();
            
            Chat.contacts.each(function () {
            
                var contact = this;
                if(contact.username != Chat.user.username) {
                    
                    Chat.list.append(
                        $('<li>')
                            .attr({'id' : contact.username})
                            .data('userCredentials', {'username':contact.username, 'jid':contact.username+'@'+Chat.options.domain+'/'+Chat.options.resource})
                            .data('presence', 'unavailable')
                            .css({'height':'24px'})
                            .addClass('chat-list-userlist-element ui-corner-all')
                            .append($('<div>').attr({'id':'icon'}).addClass('chat-list-user-notactive'))
                            .append($('<div>').addClass('chat-list-userlist-text').text(contact.username))
                            .append($('<div>')
                                    .attr({'id':'private-chat-icon', 'title': 'Prywatny chat'})
                                    .css({'float':'right', 'height':'17px', 'width':'17px', 'margin-right':'3px'})
                                    .addClass('chat-list-icon ui-corner-all') // chat-list-userlist-private-chat-icon')
                                    .append($('<span>').addClass('ui-icon ui-icon-comment'))
                                    .hide()
                                    .click(function () {
                                        Chat.contextMenu.hide();
                                        var selectedContact = $(this).parent().data('userCredentials');
                                        Chat.showChatBox(selectedContact.jid, selectedContact.username, 'chat');
                                    })
                            )
                            .bind('mouseover', function() {
                                $(this).find('#private-chat-icon').show();
                            })
                            .bind('mouseout', function() {
                                $(this).find('#private-chat-icon').hide();
                            })
                            .bind('click', function() {
                                // //$(this).addClass('chat-list-userlist-element-selected');
                                // Chat.selectedContacts.push($(this).data('userCredentials'));
                                Chat.contextMenu.hide();
                            })
                            .bind('dblclick', function () {
                                //Chat.showChatBox(contact.username+'@'+Chat.options.domain, contact.username, 'chat');
                                var selectedContact = $(this).data('userCredentials');
                                Chat.showChatBox(selectedContact.jid, selectedContact.username, 'chat');
                            })
                            .bind('contextmenu', function (e) {
                                Chat.contextMenu.data('selectedUser', $(this).data('userCredentials'));
                                Chat.contextMenu
                                    .css({
                                        left : e.pageX,
                                        top : e.pageY,
                                        zIndex : '101'
                                    })
                                    .show();
                                
                                return false;
                            })
                    );
                    //.append($('<span>').css({'height':'24px', 'width':'100%', 'z-index':'20000', 'background':'red'}).click(function(){alert('a kuku');}))
                    //        ;
                    
                    // send request to subscribe of users status
                    Chat.connection.send($pres({'to':contact.username+'@'+Chat.options.domain, type: 'subscribe'}));
                }
            });
        },
        
        clearUserList : function () {

            Chat.list.children().each(function () {
                $(this).remove();
            });
        },
        
        /*
         * Main callback function for receiving messages from server
         */
        onMessage : function (msg) {
            
            var to = msg.getAttribute('to');
            var from = msg.getAttribute('from');
            var type = msg.getAttribute('type');
            var elems = msg.getElementsByTagName('body');
            
            // Chat.log('OnMessage: ' + type + ':::' + Strophe.getBareJidFromJid(from) + '(resource: '+Strophe.getResourceFromJid(from)+')');
            
            if (elems.length > 0) {
                
                var body = elems[0];
                
                if (type == "chat" || type == "normal") {
                    var jid = from; //Strophe.getBareJidFromJid(from);
                    var username = Strophe.getNodeFromJid(from);
                    var text = Strophe.getText(body);
                    var chatBox = Chat._getChatBox(jid, username, 'chat');
                    chatBox.UpdateChat(jid, username, text);
                    chatBox.Maximize();
                } 
                else if (type == "groupchat") {
                    var jid = Strophe.getBareJidFromJid(from);
                    var username = Strophe.getResourceFromJid(from);
                    if(username != null) { // skip information messages
                        var text = Strophe.getText(body);
                        var chatBox = Chat._getChatBox(jid, 'Rozmowa grupowa', 'groupchat');
                        chatBox.UpdateChat(jid, username, text);
                        chatBox.Maximize();
                    }
                }
            }

            // we must return true to keep the handler alive.  
            // returning false would remove it after it finishes.
            return true;
        },
        
        
        /*
         * Handler of subscriptions presence requests
         */
        onPresenceSubscriptionRequest : function (presence) {
            // just agree and sent response
            var from = presence.getAttribute('from');
            Chat.connection.send($pres({ to: Strophe.getBareJidFromJid(from), type: "subscribed" }));
            
            return true;
        },
        
        /*
         * Main callback function for receiving presences from server
         */
        onPresence : function (presence) {
            
            var to = presence.getAttribute('to');
            var from = presence.getAttribute('from');
            var type = presence.getAttribute('type');
            var jid = Strophe.getBareJidFromJid(from);
            var username = Strophe.getNodeFromJid(from);
            
            // Chat.log('OnPresence: '+Strophe.getBareJidFromJid(from));
        
            // update chat list 
            var userElement = $('li#'+username);
            var icon = userElement.find('div#icon');
            if(type == 'unavailable') { // status of other users
                userElement.data('presence', 'unavailable');
                icon.addClass('chat-list-user-notactive');
                icon.removeClass('chat-list-user-active');
            }
            else { 
                userElement.data('presence', 'available');
                icon.addClass('chat-list-user-active');
                icon.removeClass('chat-list-user-notactive');
            }
            
            //update existing chat box
            for(var i=0; i<Chat.chatBoxes.length; i++) {
                var chatBox = Chat.chatBoxes[i];
                //if(chatBox.jid == jid) {
                    chatBox.updatePresence();
                //    break;
                //}
            }
        
            // we must return true to keep the handler alive.  
            // returning false would remove it after it finishes.
            return true;
        },
        
        /*
         * When other user invite me to gropuchat - just accept request
         */
        onConferenceRequest : function (request) {
            
            var elems = request.getElementsByTagName('x');
                        
            if (elems.length > 1) {
                var x = elems[1];
                var room_jid = Strophe.getBareJidFromJid(x.getAttribute('jid'));
                Chat.connection.muc.join(room_jid, Chat.user.username);
            }
            
            return true;
        },
 
        /*
         * Shows chat box, try to find it or create it first then maximize it
         */
        showChatBox : function (id, username, type) {
            
            if(!Chat.connection.connected) return;
            if(!Chat.connection.authenticated) return;
            
            var chatBox = Chat._getChatBox(id, username, type);
            chatBox.Maximize(); 
        },
        
        sendMessage : function (jid, type,  msg) {
            
            if (Chat.connection.connected && Chat.connection.authenticated) {
                if (msg.length > 0) {

                    var reply = $msg({
                            to : jid, //Strophe.getBareJidFromJid(jid), //Strophe.getDomainFromJid(jid), // TODO: get whole jid
                            from : Chat.connection.jid,
                            type : type
                        }).c("body").t(msg);
                    
                    Chat.connection.send(reply.tree());
                }
            } else {
                // Chat.log("You have to log in before you can send msg");
            }
        },
        
        /*
         * PRIVATE
         * Try to find chat box in already initiated chatboxes
         */
        _findChatBoxByJid : function(jid) {
        
            for(var i=0; i<Chat.chatBoxes.length; i++) {
                var chatBox = Chat.chatBoxes[i];
                if(chatBox.jid == jid) {
                    return chatBox;
                }
            }
            
            return null;
        },
        
        /*
         * PRIVATE
         * Check if chatbox exists and return it (if not exists create it first)
         */
        _getChatBox : function(jid, name, type) {
        
            var chatBox = Chat._findChatBoxByJid(jid);
            if(chatBox == null) { // chatbox not found, create new one
                var chatBox = new ChatBox(jid, name, type);
                Chat.chatBoxes.push(chatBox);
                Chat.container.append(chatBox.Get$());
            }
            
            return chatBox;
        },
        
        /************************** GUI *****************************/
        isMinimized : false, // indicator if chat list is opened or not
        chatBoxes : [], // list of opened chat boxes
        listContainer : null, // main chat list of contacts panel 
        header : null, // header of chat list panel
        main : null, // main part of chat list panel
        footer : null, // footer of chat list panel
        list : null, // main user list container
        userIcon : null, // login icon (green or gray)
        minimizeBox : null, // control button to minimzie chat list
        maximizeBox : null, // control button to maximize chat list
        loginBox : null, // control button to login/logout actions
        contextMenu : null, // context menu handle for list of users
        
        /*
         * Creates main panel of chat (list of contacts)
         */
        createMainGui : function() {

            var listContainer = $('<div>').addClass('chat-list');
            
            // create main panel
            var header = $('<div>')
                                    .addClass('chat-list-header')
                                    .dblclick(function() {
                                        if(Chat.isMinimized)
                                            Chat.maximize();
                                        else
                                            Chat.minimize();
                                    });
            var main = $('<div>').addClass('chat-list-main');
            var footer = $('<div>').addClass('chat-list-footer');
            listContainer.append(header);
            listContainer.append(main);
            listContainer.append(footer);
            
            // login icon (green or gray)
            var userIcon = $('<div>').addClass('chat-list-user-notactive');
            header.append(userIcon);
            
            // header text
            var headerText = $('<div>')
                                        .addClass('chat-list-header-text')
                                        .html('Niedostępny');
            header.append(headerText);
            
            // header control icons
            var headerIcons = $('<div>').addClass('chat-list-header-icons');

            // header control icons: minimize box
            var minimizeBox = $('<div>')
                                    .addClass('chat-list-icon ui-corner-all')
                                    .append($('<span>').addClass('ui-icon ui-icon-triangle-1-s'))
                                    .attr({'title': 'Minimalizuj'})
                                    .click(function(){
                                        Chat.minimize();
                                    });
            headerIcons.append(minimizeBox);
            
            // header control icons: maximize box
            var maximizeBox = $('<div>')
                                    .addClass('chat-list-icon ui-corner-all')
                                    .append($('<span>').addClass('ui-icon ui-icon-triangle-1-n'))
                                    .attr({'title': 'Pokaż czat'})
                                    .hide()
                                    .click(function(){
                                        Chat.maximize();
                                    });
            headerIcons.append(maximizeBox);
            
            // header control icons: login/logout box
            var loginBox = $('<div>')
                                    .addClass('chat-list-icon ui-corner-all')
                                    .append($('<span>').addClass('ui-icon ui-icon ui-icon-power'))
                                    .attr({'title' : 'Wyloguj'})
                                    .click(function(){
                                        if(Chat.connection.connected) {
                                            Chat.logout();
                                            loginBox.attr({'title': 'Zaloguj'});
                                        }
                                        else {
                                            Chat.login();
                                            loginBox.attr({'title': 'Wyloguj'});
                                        }
                                    });
            headerIcons.append(loginBox);
            header.append(headerIcons);
            
            // user list - panel of contacts
            var list = $('<ol>').addClass('chat-list-userlist')
                    .selectable({
                    stop : function () {
                        //var result = $("#select-result").empty();
                        Chat.selectedContacts = [];
                        $(".ui-selected", this).each(function () {
                            var index = $("#selectable li").index(this);
                            //console.log(Chat.contacts[index]);
                            //result.append(" #" + (index + 1));
                            //console.log($(this).data('userCredentials').username);
                            Chat.selectedContacts.push($(this).data('userCredentials'));
                        });
                    },
                    cancel: 'span' 
            });
            main.append(list);
            
            // create context menu and bind it to document
            Chat.contextMenu = Chat.createContextMenu();
            
            // store global variables
            Chat.listContainer = listContainer;
            Chat.header = header;
            Chat.main = main;
            Chat.footer = footer;
            Chat.userIcon = userIcon;
            Chat.headerText = headerText;
            Chat.minimizeBox = minimizeBox;
            Chat.maximizeBox = maximizeBox;
            Chat.loginBox = loginBox;
            Chat.list = list;
            
            return listContainer;
        },
        
        createContextMenu : function () {
            
            var contextMenu = 
                $('<ul>').hide()
                    .append($('<li>')
                        .append($('<a>')
                            .attr({'href':'#'})
                            .text('Prywatny chat')
                            .append($('<span>').addClass('ui-icon ui-icon-person'))
                        )
                        .click(function () {
                            contextMenu.hide();
                            Chat.showChatBox(
                                    contextMenu.data('selectedUser').jid, 
                                    contextMenu.data('selectedUser').username,
                                    'chat'
                                );
                        })
                        .bind('contextmenu', function () {
                            contextMenu.hide();
                            return false;
                        })
                    )
                    .append($('<li>')
                        .append($('<a>')
                            .attr({'href':'#'})
                            .text('Rozmowa grupowa')
                            .append($('<span>').addClass('ui-icon ui-icon-comment'))
                        )
                        .click(function () {
                            contextMenu.hide();
                            
                            var room_jid = 'conference'+Math.floor((Math.random()*10000)+1)+'@conference.'+Strophe.getDomainFromJid(Chat.user.jid);
                            
                            //Create groupchat room
                            Chat.connection.muc.join(room_jid, Chat.user.username, function(msg) {
                                
                                var config = new Array();
                                config.push("field");
                                //TODO: add logging, if default setting will not work
                                
                                Chat.connection.muc.configure(room_jid, function(config) {
                                    Chat.connection.muc.saveConfiguration(room_jid, config, function() {
                                        
                                        for(var i=0; i<Chat.selectedContacts.length; i++) {
                                        
                                            Chat.connection.muc.invite( room_jid, 
                                                                        Chat.selectedContacts[i].jid, 
                                                                        null
                                                                      );
                                                                      
                                        }
                                    });
                                });
                            });

                            Chat.showChatBox(
                                     room_jid, 
                                     'Rozmowa grupowa',
                                     'groupchat'
                                 );
                                
                        })
                        .bind('contextmenu', function () {
                            contextMenu.hide();
                            return false;
                        })
                    )
                    .css({
                        left : '0px',
                        top : '0px',
                        position : 'absolute',
                        width: '150px'
                    })
                    .appendTo(document.body)
                    .menu();
                    
            return contextMenu;
        },
        
        minimize : function () {
            
            Chat.maximizeBox.show();
            Chat.minimizeBox.hide();
            Chat.footer.hide();
            Chat.main.hide();
            Chat.listContainer.removeClass('chat-list-maximized');
            Chat.listContainer.addClass('chat-list-minimized');
            
            Chat.isMinimized = true;
        },
        
        maximize : function () {
            
            Chat.maximizeBox.hide();
            Chat.minimizeBox.show();
            Chat.footer.show();
            Chat.main.show();
            Chat.listContainer.removeClass('chat-list-minimized');
            Chat.listContainer.addClass('chat-list-maximized');
            
            Chat.isMinimized = false;
        }
    }
    
    
        /*
     * Chat Box
     */ 
    var ChatBox = function(jid, username, type) {
            
        var self = this;
        
        /*
         * class fields
         */
        //self.chatController = controller;
                
        self.jid = jid;
        self.username = username;
        self.type = type;
        self.isMinimized = false;
        self.chatBox = $('<div>').addClass('chat-box');
        self.chatBoxHeader = $('<div>')
                                .addClass('chat-box-header')
                                .dblclick(function() {
                                    if(self.isMinimized)
                                        self.Maximize();
                                    else
                                        self.Minimize();
                                });
        self.chatBoxMain = $('<div>').addClass('chat-box-main');
        self.chatBoxFooter = $('<div>').addClass('chat-box-footer');
        
        self.chatBox.append(self.chatBoxHeader);
        self.chatBox.append(self.chatBoxMain);
        self.chatBox.append(self.chatBoxFooter);
        
        self.chatBoxHeader.append(
                            $('<div>')
                                .addClass('chat-box-header-text')
                                .html('<strong>'+self.username+'</strong>')
                            );

        self.chatBoxTextArea = $('<div>')
                                    .addClass('chat-box-textarea');
        self.chatBoxMain.append(self.chatBoxTextArea);                 

        self.chatBoxWarning = $('<div>').addClass('chat-box-warning').hide();
        self.chatBoxWarningText = $('<div>').addClass('chat-box-warning-text');
        self.chatBoxWarning.append(self.chatBoxWarningText)
        self.chatBoxMain.append(self.chatBoxWarning);          
        
        self.chatBoxInput = $('<input>')
                                .addClass('chat-box-input')
                                .attr({
                                    'type' : 'text'
                                })
                                .bind('keypress', function (e) {
                                    var code = (e.keyCode ? e.keyCode : e.which);
                                    var value = self.chatBoxInput.val();
                                    if (code == 13 && value != '') { 
                                        e.stopPropagation();
                                        self.Send(value);
                                    }
                                });
        self.chatBoxFooter.append(self.chatBoxInput);
        
        var sendButton = $('<div>')
                                .addClass('chat-box-icon ui-corner-all chat-box-sendbutton')
                                .append($('<span>').addClass('ui-icon ui-icon-comment'))
                                .attr({'title': 'Wyślij'})
                                .click(function(){
                                    var value = self.chatBoxInput.val();
                                    if (value != '') { 
                                        self.Send(value);
                                    }
                                });
        self.chatBoxFooter.append(sendButton);
        

                            
        var headerIcons = $('<div>').addClass('chat-box-header-icons');

        // minimize box
        self.minimizeBox = $('<div>')
                                .addClass('chat-box-icon ui-corner-all')
                                .append($('<span>').addClass('ui-icon ui-icon-triangle-1-s'))
                                .attr({'title': 'Minimalizuj'})
                                .click(function(){
                                    self.Minimize();
                                });
        headerIcons.append(self.minimizeBox);

        // maximize box
        self.maximizeBox = $('<div>')
                                .addClass('chat-box-icon ui-corner-all')
                                .append($('<span>').addClass('ui-icon ui-icon-triangle-1-n'))
                                .attr({'title': 'Pokaż czat'})
                                .hide()
                                .click(function(){
                                    self.Maximize();
                                });
        headerIcons.append(self.maximizeBox);
        
        // close box
        self.closeBox = $('<div>')
                                .addClass('chat-box-icon ui-corner-all')
                                .append($('<span>').addClass('ui-icon ui-icon-closethick'))
                                .attr({'title': 'Zamknij czat'})
                                .click(function(){
                                    self.Destroy();
                                });
        headerIcons.append(self.closeBox);
        
        self.chatBoxHeader.append(headerIcons)
        
        //TODO: presence
        // $.ajax({
            // url : 'presence/status',
            // data : {'jid' : self.jid, 'type': 'text'},
            // success : function(status) {
                // alert(status);
                // if(status == 'null')
                    // self.Warning('show', 'Użytkownik '+self.username+' nie otrzyma tych wiadomości natychmiast ponieważ nie jest zalogowany.');
                // else
                    // self.Warning('hide');
            // }
        // });

        self.chatBoxInput.focus();
    };
    
    ChatBox.prototype.Get$ = function () {
    	return this.chatBox;
    }
    
    ChatBox.prototype.Minimize = function () {
    	
    	var self = this;
        self.maximizeBox.show();
    	self.minimizeBox.hide();
    	self.chatBoxFooter.hide();
    	self.chatBoxMain.hide();
    	self.chatBox.removeClass('chat-box-maximized');
    	self.chatBox.addClass('chat-box-minimized');
    	
        self.isMinimized = true;
    }
    ChatBox.prototype.Maximize = function () {
    	
    	var self = this;
        
        self.updatePresence();
    	self.maximizeBox.hide();
    	self.minimizeBox.show();
    	self.chatBoxFooter.show();
    	self.chatBoxMain.show();
    	self.chatBox.removeClass('chat-box-minimized');
    	self.chatBox.addClass('chat-box-maximized');
        self.chatBox.show();
                
        self.chatBoxInput.focus();
        
        self.isMinimized = false;
    }
    
    ChatBox.prototype.Destroy = function () {
    
    	var self = this;

        // self.maximizeBox.hide();
    	// self.minimizeBox.hide();
    	// self.chatBoxFooter.hide();
    	// self.chatBoxMain.hide();
    	self.chatBox.hide();
        
        
        // if chat box is related to groupchat, then leave room on the end
        if (self.type == 'groupchat') {
            Chat.connection.muc.leave(self.jid, Chat.user.username);
            
            delete self.isMinimized;
            delete self.chatBox;
            delete self.chatBoxMain;
            delete self.chatBoxFooter;
            delete self.chatBoxHeader;
            delete self.chatBoxInput;
            delete self.minimizeBox;
            delete self.maximizeBox;
            delete self.closeBox;
            delete self.chatBox;
            delete self;
        }
    }
    
    ChatBox.prototype.Warning = function (action, text) {
        
        var self = this;
        
        if(action == 'show') {
            self.chatBoxTextArea.addClass('chat-box-textarea-warning');
            self.chatBoxTextArea.removeClass('chat-box-textarea');
            self.chatBoxWarningText.html(text);
            self.chatBoxWarning.show();
        }
        else if(action == 'hide') {
            self.chatBoxTextArea.addClass('chat-box-textarea');
            self.chatBoxTextArea.removeClass('chat-box-textarea-warning');
            self.chatBoxWarning.hide();        
        }
        else {
        
        }
        
        self.chatBoxTextArea.scrollTop(
                        self.chatBoxTextArea[0].scrollHeight
                        - self.chatBoxTextArea.height()
                     );
    }
    
    ChatBox.prototype.Send = function (value) {
    	
        var self = this;
    	
        if(self.type == 'chat') {
            
            Chat.sendMessage(self.jid, 'chat', value);
            
            var header = '';
            if (self.lastWriter != Chat.user.username) {
                var now = new Date();
                var hours = now.getHours();
                var minutes = now.getMinutes();
                if (minutes < 10)
                    minutes = "0" + minutes;
                var seconds = now.getSeconds();
                if (seconds < 10)
                    seconds = "0" + seconds;
                
                header = "<span style='color: gray; font-size: 90%; float: right;'>" 
                        + hours + ':' + minutes + ':' + seconds + '</span> '
                        + "<span style='color: gray; font-size: 90%;'>" + Chat.user.username + '</span>'
                    
            }
            self.chatBoxTextArea.append(
                                    header 
                                    + "<div style='padding-left: 10px; padding-bottom: 3px;'>"
                                    + value 
                                    + '</div>'
                                );
            self.chatBoxTextArea.scrollTop(
                                    self.chatBoxTextArea[0].scrollHeight
                                    - self.chatBoxTextArea.height()
                                 );
            
            self.lastWriter = Chat.user.username;
    	}
        else { // groupchat
            var jid = Strophe.getBareJidFromJid(self.jid);//+'/'+self.username; 
            Chat.sendMessage(jid, 'groupchat', value);
        }
    	self.chatBoxInput.val('');
    	self.chatBoxInput.focus();
    }

    ChatBox.prototype.updatePresence = function () {
        
        var self = this;
        
        if (self.type == 'chat') {
            // update chat list 
            var presence = $('li#'+self.username).data('presence');
            if(presence == 'unavailable') {
                self.Warning('show', 'Użytkownik <strong>'+self.username+'</strong> nie jest dostępny. Te wiadomości dotrą do niego dopiero gdy będzie zalogowany.');
            }
            else {
                self.Warning('hide');
            }
        }
    }
    
    ChatBox.prototype.onMessage = function (jid, username, msg) {
        
        var self = this;
        self.UpdateChat(jid, username, msg);
        self.Maximize();
    }
    
    //TODO: combine both functions
    
    ChatBox.prototype.UpdateChat = function (jid, username, text) {
    	
        var self = this;
    
    	var header = '';
    	if (self.lastWriter != username) {
    		var now = new Date();
    		var hours = now.getHours();
    		var minutes = now.getMinutes();
    		if (minutes < 10)
    			minutes = "0" + minutes;
    		var seconds = now.getSeconds();
    		if (seconds < 10)
    			seconds = "0" + seconds;
    		
    		header = "<span style='color: gray; font-size: 90%; float: right;'>" 
                    + hours + ':' + minutes + ':' + seconds + '</span> '
                    + "<span style='color: gray; font-size: 90%;'>" + username + '</span>'
    			
    	}
    	self.chatBoxTextArea.append(
                                header 
                                + "<div style='padding-left: 10px; padding-bottom: 3px;'>"
                                + text 
                                + '</div>'
                            );
    	self.chatBoxTextArea.scrollTop(
                                self.chatBoxTextArea[0].scrollHeight
                                - self.chatBoxTextArea.height()
                             );
    	
    	self.lastWriter = username;
     
    }  
    
    $.fn.chat = function (method, options) {
        
        Chat.options = $.extend(Chat.options, options);
        
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