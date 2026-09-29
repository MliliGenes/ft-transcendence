const players = [
    { id: "1", username: "Eva", team: "A", matchId: "match-1" },
    { id: "2", username: "Magnus", team: "A", matchId: "match-1" },
    { id: "3", username: "Hector", team: "B", matchId: "match-1" },
    { id: "4", username: "Ben300", team: "B", matchId: "match-1" },

    { id: "5", username: "Alex", team: "A", matchId: "match-2" },
    { id: "6", username: "Sam", team: "B", matchId: "match-2" }
];

function findPlayerByUsername(username) {
    return players.find(player => player.username === username);
}

module.exports = {
    findPlayerByUsername
};