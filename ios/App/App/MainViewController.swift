import UIKit
import Capacitor

/// The app's bridge view controller (Main.storyboard). It exists only to
/// register plugins that live in this app rather than in an npm package:
/// Capacitor discovers packaged plugins on its own, but in-app ones must be
/// handed to the bridge here.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
    }
}
