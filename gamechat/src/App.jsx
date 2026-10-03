import GameChat from "./components/GameChat";

function App() {
    const currentUser = {
        id: "1",
        username: sessionStorage.getItem("chatUsername") || "Eva"
    };

    return (
        <GameChat
            currentUser={currentUser}
            accessToken={null}
        />
    );
}

export default App;