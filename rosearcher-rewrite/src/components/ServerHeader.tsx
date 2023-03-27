import React from "react";

interface ServerHeaderProps {
    children?: JSX.Element | JSX.Element[];
}

function ServerHeader({ children }: ServerHeaderProps) {
    return (
        <div key="rosearcher-header" id="rosearcher-header" className="stack">
            <div key="container-header" className="container-header">
                <h2>RoSearcher</h2>
                {children}
            </div>
        </div>
    );
}
ServerHeader.defaultProps = {
    children: [],
};

export default ServerHeader;