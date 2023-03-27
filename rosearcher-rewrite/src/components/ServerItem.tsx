import React, { ReactNode } from 'react';

interface ServerItemProps {
    children?: ReactNode[];
}
function ServerItem({ children }: ServerItemProps) {
    return (
        <li className="rbx-private-game-server-item col-md-3 col-sm-4 col-xs-6 highlighted">
            <div className="card-item">{children}</div>
        </li>
    );
}

ServerItem.defaultProps = {
    children: [],
};

export default ServerItem;