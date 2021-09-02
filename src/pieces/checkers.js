import blackChecker from "../assets/black-checker.svg"
import whiteChecker from "../assets/white-checker.svg"
import blackKing from "../assets/black-king.svg"
import whiteKing from "../assets/white-king.svg"

import BasePiece from "./base"

export default class Checker extends BasePiece {
  constructor(props) {
    super()
    this.state = {
      king: props.king,
      // draggable: props.white,
    }
  }

  render() {
    const king = this.props.king
    const white = this.props.white
    return <img
      src={king ? (white ? whiteKing : blackKing) : (white ? whiteChecker : blackChecker)}
      alt={`A ${white ? "White" : "Black"} ${king ? "King" : "Checker"}`}
      // draggable={this.state.draggable}
      className={"piece"}
    />
  }
}
