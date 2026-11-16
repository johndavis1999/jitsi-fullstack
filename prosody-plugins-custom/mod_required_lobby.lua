local util = module:require 'util';
local is_admin = util.is_admin;
local is_healthcheck_room = util.is_healthcheck_room;

module:hook('muc-occupant-pre-join', function(event)
    local room, occupant, session = event.room, event.occupant, event.origin;

    if is_admin(occupant.bare_jid) or is_healthcheck_room(room.jid) then
        return;
    end

    if not room:get_members_only() or not room._data.lobbyroom then
        prosody.events.fire_event('create-persistent-lobby-room', {
            room = room;
            skip_display_name_check = true;
        });
    end

    local user = session and session.auth_token and session.jitsi_meet_context_user;
    if user and (user.moderator == true or user.moderator == 'true'
        or user.affiliation == 'owner' or user.affiliation == 'moderator' or user.affiliation == 'teacher') then
        room:set_affiliation(true, occupant.bare_jid, 'owner');
        occupant.role = 'moderator';
        if room.jid:match('^native%-') then
            room._data.native_host_assigned = true;
        end
    elseif room.jid:match('^native%-') and not room._data.native_host_assigned then
        room._data.native_host_assigned = true;
        room:set_affiliation(true, occupant.bare_jid, 'owner');
        occupant.role = 'moderator';
    end
end, -3.75);

module:hook('muc-occupant-joined', function(event)
    local room = event.room;
    if room._data.lobbyroom and room:get_members_only() then
        room.jitsiMetadata = room.jitsiMetadata or {};
        room.jitsiMetadata.lobbyEnabled = true;
        module:fire_event('room-metadata-changed', { room = room });
    end
end, -1);

module:hook('muc-config-submitted', function(event)
    if not is_healthcheck_room(event.room.jid) and event.room._data.lobbyroom then
        event.fields['muc#roomconfig_membersonly'] = true;
        event.fields['muc#roomconfig_roomsecret'] = '';
    end
end, 100);