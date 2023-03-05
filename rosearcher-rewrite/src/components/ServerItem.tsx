import React, { ReactNode } from 'react';

export interface ServerItemProps {
    children?: ReactNode[];
}
export function ServerItem({ children }: ServerItemProps) {
    return (
        <li className="rbx-private-game-server-item col-md-3 col-sm-4 col-xs-6 highlighted">
            <div className="card-item">{children}</div>
        </li>
    );
}

ServerItem.defaultProps = {
    children: [],
};