import React, { ReactNode, MouseEventHandler } from "react";

interface GameButtonProps {
    children?: ReactNode;
    onClick: MouseEventHandler<HTMLButtonElement>;
}

function GameButton({ children, onClick }: GameButtonProps) {
    return (
        <button
            type="button"
            className="btn-full-width btn-control-xs rbx-private-game-server-join game-server-join-btn btn-primary-md btn-min-width"
            onClick={onClick}
        >
            {children}
        </button>
    );
}
GameButton.defaultProps = {
    children: [],
};

export default GameButton;