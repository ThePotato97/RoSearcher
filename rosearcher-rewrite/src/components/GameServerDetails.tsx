import React from 'react';

interface PlayerInfo {
    id: string;
    name: string;
    thumbnail: string;
}

export interface GameServerDetailsProps {
    playerInfo: PlayerInfo;
    maxPlayers: number;
    currentPlayers: number;
    children?: JSX.Element | JSX.Element[];
}


function GameServerDetails({
    playerInfo, maxPlayers, currentPlayers, children,
}: GameServerDetailsProps) {
    return (
        <div className="rbx-private-game-server-details game-server-details border-right">
            <div className="section-header">
                <span className="font-bold" />
            </div>
            <div className="rbx-private-owner">
                <a
                    className="avatar avatar-card-fullbody owner-avatar"
                    href={`https://www.roblox.com/users/${playerInfo.id}/profile`}
                    title={playerInfo.name}
                >
                    <span className="thumbnail-2d-container avatar-card-image">
                        <img
                            className=""
                            src={playerInfo.thumbnail}
                            alt=""
                            title="" />
                    </span>
                </a>
                <a
                    className="text-name text-overflow"
                    href="https://www.roblox.com/users/13277651/profile"
                >
                    <span data-rblx-badge-text-container="" className="jss119">
                        <span
                            data-rblx-badge-text-el=""
                            className="jss117"
                            style={{ fontWeight: '500' }}
                        >
                            <span className="jss120">{playerInfo.name}</span>
                        </span>
                        <span
                            data-rblx-badge-icon-el=""
                            role="button"
                            tabIndex={0}
                            className="jss115" />
                    </span>
                </a>
            </div>
            <div className="text-info rbx-game-status rbx-private-game-server-status text-overflow">
                {`${currentPlayers} of ${maxPlayers} people max`}
            </div>
            <div className="server-player-count-gauge border">
                <div
                    className="gauge-inner-bar border"
                    style={{
                        width: `${(currentPlayers / (maxPlayers || 1)) * 100}%`,
                    }} />
            </div>
            <span>{children}</span>
        </div>
    );
}
GameServerDetails.defaultProps = {
    children: [],
};

export default GameServerDetails;