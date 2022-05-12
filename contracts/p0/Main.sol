// SPDX-License-Identifier: BlueOak-1.0.0
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "contracts/libraries/Fixed.sol";
import "contracts/interfaces/IMain.sol";
import "contracts/mixins/ComponentRegistry.sol";
import "contracts/mixins/Pausable.sol";

/**
 * @title Main
 * @notice Collects all mixins.
 */
// solhint-disable max-states-count
contract MainP0 is Initializable, ContextUpgradeable, ComponentRegistry, Pausable, IMain {
    using FixLib for int192;

    IERC20 public rsr;

    /// Initializer
    function init(
        Components memory components,
        IERC20 rsr_,
        uint32 oneshotPauseDuration_
    ) public virtual initializer {
        __Pausable_init(oneshotPauseDuration_);
        __ComponentRegistry_init(components);

        rsr = rsr_;

        emit MainInitialized();
    }

    /// @custom:action
    function poke() external {
        require(!paused(), "paused");
        _poke();
    }

    /// @custom:subroutine
    // solhint-disable-next-line func-name-mixedcase
    function poke_sub() external {
        require(isComponent(_msgSender()), "caller is not a component");
        _poke();
    }

    function owner() public view override(IMain, OwnableUpgradeable) returns (address) {
        return OwnableUpgradeable.owner();
    }

    // === See docs/security.md ===

    function beginActionTx() external virtual {
        require(isComponent(_msgSender()), "caller is not a component");
        require(!paused(), "paused");
    }

    function beginGovernanceTx(address prevCaller) external virtual {
        require(isComponent(_msgSender()), "caller is not a component");
        require(OwnableUpgradeable.owner() == prevCaller, "prev caller is not the owner");
    }

    function beginSubroutine(address prevCaller) external virtual {
        require(isComponent(_msgSender()), "caller is not a component");
        require(isComponent(prevCaller), "tx caller is not a component");
    }

    // solhint-disable-next-line no-empty-blocks
    function endTx() external virtual {}

    function _poke() internal {
        assetRegistry.forceUpdates();
        furnace.melt();
        stRSR.payoutRewards();
    }
}
