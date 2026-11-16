local hooks = {};
local events = {};
module = {
    require = function(_, name)
        assert(name == 'util');
        return {
            is_admin = function(jid) return jid == 'focus@auth.meet.jitsi' end;
            is_healthcheck_room = function(jid) return jid == 'health@muc.meet.jitsi' end;
        };
    end;
    hook = function(_, name, callback, priority)
        hooks[name] = { callback = callback; priority = priority; };
    end;
    fire_event = function(_, name, event)
        assert(name == 'room-metadata-changed');
        assert(event.room.jitsiMetadata.lobbyEnabled == true);
    end;
};
prosody = { events = { fire_event = function(name, event)
    table.insert(events, { name = name; event = event; });
    event.room.members_only = true;
    event.room._data.lobbyroom = 'lobby.meet.jitsi';
end } };

dofile(arg[1]);
local hook = assert(hooks['muc-occupant-pre-join']);
assert(hook.priority < -3.5 and hook.priority > -4);
local room = { jid = 'meeting@muc.meet.jitsi'; _data = {}; members_only = false };
function room:get_members_only() return self.members_only end
function room:set_affiliation(_, jid, affiliation) self.affiliations = self.affiliations or {}; self.affiliations[jid] = affiliation end
local guest = { room = room; occupant = { bare_jid = 'guest@guest.meet.jitsi' } };
hook.callback(guest);
assert(#events == 1 and events[1].name == 'create-persistent-lobby-room');
hook.callback(guest);
assert(#events == 1);
room.members_only = false;
hook.callback(guest);
assert(#events == 2);
local host = { room = room; occupant = { bare_jid = 'host@meet.jitsi' };
    origin = { auth_token = 'verified'; jitsi_meet_context_user = { moderator = true } } };
hook.callback(host);
assert(room.affiliations['host@meet.jitsi'] == 'owner' and host.occupant.role == 'moderator');
assert(room.affiliations['guest@guest.meet.jitsi'] == nil and #events == 2);
local unverified = { room = room; occupant = { bare_jid = 'other@meet.jitsi' };
    origin = { jitsi_meet_context_user = { moderator = true } } };
hook.callback(unverified);
assert(room.affiliations['other@meet.jitsi'] == nil);
local config = { room = room; fields = { ['muc#roomconfig_membersonly'] = false;
    ['muc#roomconfig_roomsecret'] = 'password' } };
hooks['muc-config-submitted'].callback(config);
assert(config.fields['muc#roomconfig_membersonly'] == true);
assert(config.fields['muc#roomconfig_roomsecret'] == '');
hook.callback({ room = room; occupant = { bare_jid = 'focus@auth.meet.jitsi' } });
hook.callback({ room = { jid = 'health@muc.meet.jitsi' }; occupant = guest.occupant });
assert(#events == 2);
local native = { jid = 'native-test@muc.meet.jitsi'; _data = {}; members_only = false };
native.get_members_only = room.get_members_only;
native.set_affiliation = room.set_affiliation;
local first = { room = native; occupant = { bare_jid = 'first@guest.meet.jitsi' }; origin = {} };
hook.callback(first);
assert(native.affiliations['first@guest.meet.jitsi'] == 'owner' and first.occupant.role == 'moderator');
hooks['muc-occupant-joined'].callback(first);
assert(native.jitsiMetadata.lobbyEnabled == true);
local second = { room = native; occupant = { bare_jid = 'second@guest.meet.jitsi' }; origin = {} };
hook.callback(second);
assert(native.affiliations['second@guest.meet.jitsi'] == nil and second.occupant.role == nil);
assert(room.affiliations['guest@guest.meet.jitsi'] == nil);
print('required lobby checks passed');