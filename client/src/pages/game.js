import React from "react"
import { Redirect } from "react-router"
import { Badge, Button, Drawer, Grid } from "@material-ui/core"

import Board from "../components/board"
import Grave from "../components/grave"
import { RandomCheckers } from "../games/test"
import { RussianCheckers, InternationalCheckers } from "../games/checkers"


function convertGametype(number) {
  switch (number) {
    case 0: return new RandomCheckers()
    case 1: return new RussianCheckers()
    case 2: return new InternationalCheckers()
  }
}


function representCoord(coord, flip, width) {
  var x = coord % width + 1
  var y = Math.floor(coord / width) + 1
  if (!flip) y = width + 1 - y
  else x = width + 1 - x
  return String.fromCharCode(96 + x) + y
}


function representMove({ mine, action, from, to, target }, flip, width) {
  var result = mine ? "You " : "Opponent "
  if (action === "move") {
    result += from < 0 ? `revived a piece` : `moved a piece from ${representCoord(from, flip, width)}`
    result += ` to ${representCoord(to, flip, width)}`
  } else result += `${action}ed ${representCoord(target, flip, width)}`
  return result
}


export default class Game extends React.Component {
  constructor({ ws, side, gametype }) {
    super()

    this.ws = ws
    this.ws.onmessage = (message) => {
      const json = JSON.parse(message.data)
      if (json.type === "sync") this.reproduceMove(json)
    }

    this.flip = side === 2
    this.gametype = convertGametype(gametype)
    if (this.gametype === undefined) return

    const positions = Array(this.gametype.width * this.gametype.height).fill().map(this.gametype.positioning)
    if (this.flip) positions.reverse()

    this.state = {
      positions: positions,
      fallen: Array(this.gametype.pieces.length).fill(0),
      currentDrag: null,
      currentOver: null,
      moveLog: [],
      logOpen: false,
      unreadMoves: 0,
    }
  }

  logMove(move, mine = false) {
    const moveLog = [...this.state.moveLog]
    moveLog.unshift({ ...move, mine })
    if (moveLog.length > 20) moveLog.pop()
    this.setState({ moveLog, unreadMoves: mine ? 0 : this.state.unreadMoves + 1 })
  }

  sendMove(move, revert = false) {
    this.ws.send(JSON.stringify({ ...move, type: "sync", revert }))
    if (!revert) this.logMove(move, true)
  }

  crown(squareID, animate = false) {
    const positions = [...this.state.positions]
    positions[squareID].king = !positions[squareID].king
    this.setState({ positions })
  }

  kill(squareID, animate = false) {
    const positions = [...this.state.positions]
    const fallen = [...this.state.fallen]

    // redo index getting with an abstraction!
    const index = this.gametype.pieces.findIndex(x =>
      x.white === positions[squareID].white && x.king === positions[squareID].king)
    fallen[index] += 1
    positions[squareID] = null

    this.setState({ positions, fallen })

    return index  // kostil
  }

  movePiece(from, to, animate = false) {
    const positions = [...this.state.positions]
    const fallen = [...this.state.fallen]

    this.gametype.movePiece(from, to, positions, fallen)
    this.setState({ positions, fallen })
  }

  canMovePieceTo(to) {
    return this.gametype.isMoveAllowed(this.state.currentDrag, to, this.state.positions)
  }

  handleStartDrag(squareID) {
    this.setState({ currentDrag: squareID })
  }

  handleOver(squareID) {
    this.setState({ currentOver: squareID })
  }

  handleEndDrag() {
    const from = this.state.currentDrag
    const to = this.state.currentOver

    if (to < 0 && from >= 0) {
      this.sendMove({
        type: "sync",
        action: "kill",
        target: from,
        grave: this.kill(from),
      })
    } else if (this.canMovePieceTo(to)) {
      this.movePiece(from, to)
      this.sendMove({
        type: "sync",
        action: "move",
        from, to
      })
    }
    this.setState({ currentDrag: null, currentOver: null })
  }

  handleDoubleClick(squareID) {
    this.crown(squareID)
    this.sendMove({
      type: "sync",
      action: "crown",
      target: squareID,
    })
  }

  convertCoordinate(coord) { // make an absolute coord system instead
    return coord < 0 ? coord : this.gametype.width * this.gametype.height - coord - 1
  }

  revertLastMove() {
    const move = { ...this.state.moveLog[0] }

    const moveLog = [...this.state.moveLog]
    moveLog.shift()
    this.setState({ moveLog })

    if (move.action === "move") this.movePiece(move.to, move.from)
    else if (move.action === "kill") this.movePiece(-move.grave - 1, move.target)
    else if (move.action === "crown") this.crown(move.target)
  }

  reproduceMove(json) {
    if (json.action === "move") {
      json.from = this.convertCoordinate(json.from)
      json.to = this.convertCoordinate(json.to)
      this.movePiece(json.from, json.to, true)
    } else if (json.action === "kill") {
      json.target = this.convertCoordinate(json.target)
      this.kill(json.target, true)
    } else if (json.action === "crown") {
      json.target = this.convertCoordinate(json.target)
      this.crown(json.target, true)
    } else if (json.action === "revert") {
      this.revertLastMove()
      return
    } else console.warn(`Unknown action type ${json.action}`)
    this.logMove(json)
  }

  render() {
    if (this.gametype === undefined) {
      console.warn("Auto redirect from Game")
      return <Redirect to="/" push />
    }

    return (
      <div>
        <Grid container
          spacing={0}
          direction="column"
          alignItems="center"
          style={{ minHeight: "100vh", width: "100%" }}
        >
          <Grid item xs={12}>
            <Board
              game={this}
              flip={this.flip}
              gametype={this.gametype}
              positions={this.state.positions}
              currentOver={this.state.currentOver}
              currentDrag={this.state.currentOver}
            />
          </Grid>
          <Grid item xs={12} style={{ width: "500px" }}>
            <Grid container
              spacing={0}
              direction="row"
              alignItems="center"
              justifyContent="center"
            >
              <Grid item xs={8}>
                <Grave
                  game={this}
                  gametype={this.gametype}
                  fallen={this.state.fallen}
                />
              </Grid>
              <Grid item xs={4} align="center">
                <Badge badgeContent={this.state.unreadMoves} color={"secondary"}>
                  <Button
                    onClick={() => this.setState({ logOpen: true, unreadMoves: 0 })}
                    variant="contained"
                    color={"primary"}
                  >
                    Open Logs
                  </Button>
                </Badge>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
        <Drawer anchor={"bottom"} open={this.state.logOpen} onClose={() => this.setState({ logOpen: false })} >
          <Grid container
            spacing={0}
            direction="column"
            alignItems="center"
            justifyContent="center"
            style={{ width: "100%" }}
            onDoubleClick={() => {
              this.setState({ logOpen: false })
              this.revertLastMove()
              this.sendMove({ action: "revert" }, true)
            }}
          >
            {this.state.moveLog.map((move) => (
              <Grid item xs={12}>
                {representMove(move, this.flip, this.gametype.width)}
              </Grid>))}
          </Grid>
        </Drawer>
      </div>
    )
  }

  componentWillUnmount() {
    this.ws.close()
  }
}
