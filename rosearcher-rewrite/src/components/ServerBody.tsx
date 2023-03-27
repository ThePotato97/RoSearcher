import { ReactNode } from "react";

interface ServerBody {
    children?: ReactNode | ReactNode[];
}
function ServerBody({ children }: ServerBody) {
    return (
        <ul
            id="rbx-rosearcher-game-server-item-container"
            className="card-list rbx-private-game-server-item-container"
        >
            {children}
        </ul>
    );
}
ServerBody.defaultProps = {
    children: [],
};

export default ServerBody;