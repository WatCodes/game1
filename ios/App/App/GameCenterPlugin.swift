import Foundation
import Capacitor
import GameKit

/// Game Center for Electric Cats: sign in, post scores, show leaderboards.
/// Written in-app rather than taken from npm because no maintained plugin
/// supports Capacitor 8. The JS side is src/platform/gameCenter.ts, and the
/// design is in docs/GAME_CENTER.md.
///
/// Registered by MainViewController. Every method fails soft: the game never
/// waits on Game Center, so a rejection just means a score didn't go up.
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboards", returnType: CAPPluginReturnPromise)
    ]

    /// GameKit calls the handler more than once: first with a sign-in view
    /// controller to present (if one is needed), then again when the player
    /// finishes or cancels. The promise settles on the first outcome.
    @objc func authenticate(_ call: CAPPluginCall) {
        let player = GKLocalPlayer.local
        if player.isAuthenticated {
            call.resolve(["authenticated": true])
            return
        }
        var settled = false
        player.authenticateHandler = { [weak self] viewController, _ in
            DispatchQueue.main.async {
                if let viewController = viewController {
                    self?.bridge?.viewController?.present(viewController, animated: true)
                    return
                }
                if !settled {
                    settled = true
                    call.resolve(["authenticated": player.isAuthenticated])
                }
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Game Center is not signed in")
            return
        }
        guard let leaderboardId = call.getString("leaderboardId"), let score = call.getInt("score"), score > 0 else {
            call.reject("submitScore needs a leaderboardId and a positive score")
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [leaderboardId]) { error in
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve()
            }
        }
    }

    @objc func showLeaderboards(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated else {
                call.reject("Game Center is not signed in")
                return
            }
            let controller = GKGameCenterViewController(state: .leaderboards)
            controller.gameCenterDelegate = self
            self.bridge?.viewController?.present(controller, animated: true)
            call.resolve()
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
