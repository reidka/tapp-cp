import React from 'react';
import ReactDOM from 'react-dom';

import {
    Navbar,
    Nav,
    NavItem,
    NavDropdown,
    MenuItem,
    FormGroup,
    ControlLabel,
    FormControl,
} from 'react-bootstrap';

/*** Navbar components ***/

const Notifications = props => {
    let notifications = props.appState.getUnreadNotifications();

    return (
        <NavDropdown
            noCaret
            disabled={notifications.size == 0}
            title={
                <span>
                    <i className="fa fa-bell-o" style={{ fontSize: '16px' }} />&nbsp;{notifications.size}
                </span>
            }
            id="nav-notif-dropdown"
            onToggle={willOpen => {
                if (!willOpen) {
                    props.appState.readNotifications();
                }
            }}>
            {notifications.map((text, i) =>
                <MenuItem key={'notification-' + i} dangerouslySetInnerHTML={{ __html: text }} />
            )}
        </NavDropdown>
    );
};

const Auth = props => {
    let roles = props.appState.getCurrentUserRoles(),
        role = props.appState.getSelectedUserRole(),
        name = props.appState.getCurrentUserName();

    return (
        <NavDropdown title={role + ':' + name} id="nav-auth-dropdown">
            {roles.map(
                r =>
                    role != r &&
                    <MenuItem onClick={() => props.appState.selectUserRole(r)}>
                        Switch to {r} role
                    </MenuItem>
            )}

            <MenuItem onClick={() => props.appState.logout()}>Logout</MenuItem>
        </NavDropdown>
    );
};

/*** Navbar ***/

const NavbarInst = props =>
    <Navbar fixedTop fluid>
        <Navbar.Header>
            <Navbar.Brand>TAPP:CP</Navbar.Brand>
        </Navbar.Header>

        <Nav pullRight>
            <Notifications {...props} />
            <Auth {...props} />
        </Nav>
    </Navbar>;

export { NavbarInst as Navbar };
