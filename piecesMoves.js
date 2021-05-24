const PiecesMoves = {};

function findKing(boardContent, color) {
  let kingPosition = {};
  boardContent.find((row, y) => {
    return row.find((square, x) => {
      if (square.color === color && square.piece === "king")
        return (kingPosition = { y, x });
      return false;
    });
  });
  return kingPosition;
}

PiecesMoves.isCheckmate = (boardContent, color) => {
  let pieces = [];
  boardContent.forEach((row, y) => {
    row.forEach((square, x) => {
      if (square.color === color) pieces.push({ y, x, piece: square.piece });
    });
  });

  return (
    pieces.filter(
      (piece) =>
        PiecesMoves[piece.piece + "Moves"](
          boardContent,
          { y: piece.y, x: piece.x },
          color
        ).length
    ).length === 0
  );
};

function isCheck(boardContent, position, color) {
  let checkMoves = [];

  checkMoves = checkMoves.concat(
    PiecesMoves.rawKnightMoves(boardContent, position, color).find(
      (checkMove) =>
        checkMove.type === "attack" &&
        boardContent[checkMove.y][checkMove.x].piece === "knight"
    )
  );

  checkMoves = checkMoves.concat(
    PiecesMoves.rawBishopMoves(boardContent, position, color).find(
      (checkMove) =>
        checkMove.type === "attack" &&
        (boardContent[checkMove.y][checkMove.x].piece === "bishop" ||
          boardContent[checkMove.y][checkMove.x].piece === "queen")
    )
  );

  checkMoves = checkMoves.concat(
    PiecesMoves.rawRookMoves(boardContent, position, color).find(
      (checkMove) =>
        checkMove.type === "attack" &&
        (boardContent[checkMove.y][checkMove.x].piece === "rook" ||
          boardContent[checkMove.y][checkMove.x].piece === "queen")
    )
  );

  checkMoves = checkMoves.concat(
    PiecesMoves.rawPawnMoves(boardContent, position, color).find(
      (checkMove) =>
        checkMove.type === "attack" &&
        boardContent[checkMove.y][checkMove.x].piece === "pawn"
    )
  );

  checkMoves = checkMoves.concat(
    PiecesMoves.rawKingMoves(boardContent, position, color).find(
      (checkMove) =>
        checkMove.type === "attack" &&
        boardContent[checkMove.y][checkMove.x].piece === "king"
    )
  );

  checkMoves = checkMoves.filter((move) => move);

  return checkMoves.length !== 0;
}

function isCheckOnMove(boardContent, position, newPosition, color) {
  let boardContentCopy = boardContent.map((row) => row.slice());

  boardContentCopy[newPosition.y][newPosition.x] =
    boardContentCopy[position.y][position.x];
  boardContentCopy[position.y][position.x] = {};

  let kingPosition = findKing(boardContentCopy, color);

  return isCheck(boardContentCopy, { y: kingPosition.y, x: kingPosition.x }, color);
}

PiecesMoves.rawPawnMoves = (boardContent, position, color) => {
  let possibleMoves = [];
  if (color === "white") {
    if (!boardContent[position.y + 1][position.x].piece)
      possibleMoves.push({
        y: position.y + 1,
        x: position.x,
        type: "move",
      });

    if (
      position.y === 1 &&
      !boardContent[position.y + 1][position.x].piece &&
      !boardContent[position.y + 2][position.x].piece
    )
      possibleMoves.push({
        y: position.y + 2,
        x: position.x,
        type: "move",
      });

    if (boardContent[position.y + 1][position.x + 1]?.color === "black")
      possibleMoves.push({
        y: position.y + 1,
        x: position.x + 1,
        type: "attack",
      });

    if (boardContent[position.y + 1][position.x - 1]?.color === "black")
      possibleMoves.push({
        y: position.y + 1,
        x: position.x - 1,
        type: "attack",
      });

    if (
      boardContent[position.y][position.x - 1]?.color === "black" &&
      boardContent[position.y][position.x - 1]?.enPassant
    )
      possibleMoves.push({
        y: position.y + 1,
        x: position.x - 1,
        type: "attack",
      });

    if (
      boardContent[position.y][position.x + 1]?.color === "black" &&
      boardContent[position.y][position.x + 1]?.enPassant
    )
      possibleMoves.push({
        y: position.y + 1,
        x: position.x + 1,
        type: "attack",
      });
  } else {
    if (!boardContent[position.y - 1][position.x].piece)
      possibleMoves.push({
        y: position.y - 1,
        x: position.x,
        type: "move",
      });

    if (
      position.y === 6 &&
      !boardContent[position.y - 1][position.x].piece &&
      !boardContent[position.y - 2][position.x].piece
    )
      possibleMoves.push({
        y: position.y - 2,
        x: position.x,
        type: "move",
      });

    if (boardContent[position.y - 1][position.x + 1]?.color === "white")
      possibleMoves.push({
        y: position.y - 1,
        x: position.x + 1,
        type: "attack",
      });

    if (boardContent[position.y - 1][position.x - 1]?.color === "white")
      possibleMoves.push({
        y: position.y - 1,
        x: position.x - 1,
        type: "attack",
      });

    if (
      boardContent[position.y][position.x - 1]?.color === "white" &&
      boardContent[position.y][position.x - 1]?.enPassant
    )
      possibleMoves.push({
        y: position.y - 1,
        x: position.x - 1,
        type: "attack",
      });

    if (
      boardContent[position.y][position.x + 1]?.color === "white" &&
      boardContent[position.y][position.x + 1]?.enPassant
    )
      possibleMoves.push({
        y: position.y - 1,
        x: position.x + 1,
        type: "attack",
      });
  }

  return possibleMoves;
};

PiecesMoves.pawnMoves = (boardContent, position, color) => {
  let possibleMoves = PiecesMoves.rawPawnMoves(boardContent, position, color);

  return possibleMoves.filter(
    (move) => !isCheckOnMove(boardContent, position, { y: move.y, x: move.x }, color)
  );
};

PiecesMoves.rawBishopMoves = (boardContent, position, color) => {
  let possibleMoves = [];
  for (let i = 0; i < 4; i++) {
    let flag;
    switch (i) {
      case 0:
        flag = true;
        for (
          let j = { y: position.y + 1, x: position.x + 1 };
          j.x < 8 && j.y < 8 && flag;
          j = { y: j.y + 1, x: j.x + 1 }
        ) {
          if (!boardContent[j.y][j.x].piece)
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "move",
            });
          else if (boardContent[j.y][j.x].color !== color) {
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "attack",
            });

            flag = false;
          } else flag = false;
        }
        break;
      case 1:
        flag = true;
        for (
          let j = { y: position.y + 1, x: position.x - 1 };
          j.x > -1 && j.y < 8 && flag;
          j = { y: j.y + 1, x: j.x - 1 }
        ) {
          if (!boardContent[j.y][j.x].piece)
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "move",
            });
          else if (boardContent[j.y][j.x].color !== color) {
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "attack",
            });

            flag = false;
          } else flag = false;
        }
        break;
      case 2:
        flag = true;
        for (
          let j = { y: position.y - 1, x: position.x - 1 };
          j.x > -1 && j.y > -1 && flag;
          j = { y: j.y - 1, x: j.x - 1 }
        ) {
          if (!boardContent[j.y][j.x].piece)
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "move",
            });
          else if (boardContent[j.y][j.x].color !== color) {
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "attack",
            });

            flag = false;
          } else flag = false;
        }
        break;
      case 3:
        flag = true;
        for (
          let j = { y: position.y - 1, x: position.x + 1 };
          j.x < 8 && j.y > -1 && flag;
          j = { y: j.y - 1, x: j.x + 1 }
        ) {
          if (!boardContent[j.y][j.x].piece)
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "move",
            });
          else if (boardContent[j.y][j.x].color !== color) {
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "attack",
            });

            flag = false;
          } else flag = false;
        }
        break;
      default:
    }
  }
  return possibleMoves;
};

PiecesMoves.bishopMoves = (boardContent, position, color) => {
  let possibleMoves = PiecesMoves.rawBishopMoves(boardContent, position, color);

  return possibleMoves.filter(
    (move) => !isCheckOnMove(boardContent, position, { y: move.y, x: move.x }, color)
  );
};

PiecesMoves.rawKnightMoves = (boardContent, position, color) => {
  let possibleMoves = [];
  let offsets = [
    { y: 2, x: 1 },
    { y: 2, x: -1 },
    { y: 1, x: 2 },
    { y: -1, x: 2 },
    { y: -2, x: 1 },
    { y: -2, x: -1 },
    { y: -1, x: -2 },
    { y: 1, x: -2 },
  ];
  possibleMoves = offsets.map((offset) => {
    let moveY = position.y + offset.y,
      moveX = position.x + offset.x;
    if (moveY < 8 && moveY > -1 && moveX < 8 && moveX > -1) {
      if (!boardContent[moveY][moveX].piece)
        return { y: moveY, x: moveX, type: "move" };
      else if (boardContent[moveY][moveX].color !== color)
        return { y: moveY, x: moveX, type: "attack" };
    }
    return null;
  });
  return possibleMoves.filter((move) => move);
};

PiecesMoves.knightMoves = (boardContent, position, color) => {
  let possibleMoves = PiecesMoves.rawKnightMoves(boardContent, position, color);

  return possibleMoves.filter(
    (move) => !isCheckOnMove(boardContent, position, { y: move.y, x: move.x }, color)
  );
};

PiecesMoves.rawRookMoves = (boardContent, position, color) => {
  let possibleMoves = [];
  for (let i = 0; i < 4; i++) {
    let flag;
    switch (i) {
      case 0:
        flag = true;
        for (let j = { y: position.y + 1, x: position.x }; j.y < 8 && flag; j.y++) {
          if (!boardContent[j.y][j.x].piece)
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "move",
            });
          else if (boardContent[j.y][j.x].color !== color) {
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "attack",
            });

            flag = false;
          } else flag = false;
        }
        break;
      case 1:
        flag = true;
        for (let j = { y: position.y - 1, x: position.x }; j.y > -1 && flag; j.y--) {
          if (!boardContent[j.y][j.x].piece)
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "move",
            });
          else if (boardContent[j.y][j.x].color !== color) {
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "attack",
            });

            flag = false;
          } else flag = false;
        }
        break;
      case 2:
        flag = true;
        for (let j = { y: position.y, x: position.x + 1 }; j.x < 8 && flag; j.x++) {
          if (!boardContent[j.y][j.x].piece)
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "move",
            });
          else if (boardContent[j.y][j.x].color !== color) {
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "attack",
            });

            flag = false;
          } else flag = false;
        }
        break;
      case 3:
        flag = true;
        for (let j = { y: position.y, x: position.x - 1 }; j.x > -1 && flag; j.x--) {
          if (!boardContent[j.y][j.x].piece)
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "move",
            });
          else if (boardContent[j.y][j.x].color !== color) {
            possibleMoves.push({
              y: j.y,
              x: j.x,
              type: "attack",
            });

            flag = false;
          } else flag = false;
        }
        break;
      default:
    }
  }
  return possibleMoves;
};

PiecesMoves.rookMoves = (boardContent, position, color) => {
  let possibleMoves = PiecesMoves.rawRookMoves(boardContent, position, color);

  return possibleMoves.filter(
    (move) => !isCheckOnMove(boardContent, position, { y: move.y, x: move.x }, color)
  );
};

PiecesMoves.rawQueenMoves = (boardContent, position, color) => {
  return PiecesMoves.bishopMoves(boardContent, position, color).concat(
    PiecesMoves.rookMoves(boardContent, position, color)
  );
};

PiecesMoves.queenMoves = (boardContent, position, color) => {
  let possibleMoves = PiecesMoves.rawQueenMoves(boardContent, position, color);

  return possibleMoves.filter(
    (move) => !isCheckOnMove(boardContent, position, { y: move.y, x: move.x }, color)
  );
};

PiecesMoves.rawKingMoves = (boardContent, position, color) => {
  let possibleMoves = [];
  let offsets = [
    { y: 1, x: -1 },
    { y: 1, x: 0 },
    { y: 1, x: 1 },
    { y: -1, x: 1 },
    { y: -1, x: 0 },
    { y: -1, x: -1 },
    { y: 0, x: -1 },
    { y: 0, x: 1 },
  ];
  possibleMoves = offsets.map((offset) => {
    let moveY = position.y + offset.y,
      moveX = position.x + offset.x;
    if (moveY < 8 && moveY > -1 && moveX < 8 && moveX > -1) {
      if (!boardContent[moveY][moveX].piece)
        return { y: moveY, x: moveX, type: "move" };
      else if (boardContent[moveY][moveX].color !== color)
        return { y: moveY, x: moveX, type: "attack" };
    }
    return null;
  });

  return possibleMoves.filter((move) => move);
};

PiecesMoves.kingMoves = (boardContent, position, color) => {
  let possibleMoves = [];

  possibleMoves = PiecesMoves.rawKingMoves(boardContent, position, color);

  if (!isCheck(boardContent, position, color)) {
    // Castling checks
    if (boardContent[position.y][0].castling) {
      let squaresClear = true;
      for (let x = position.x - 1; x > 0 && squaresClear; x--)
        squaresClear = !boardContent[position.y][x].piece;

      if (
        squaresClear &&
        !isCheck(boardContent, { y: position.y, x: position.x - 1 }, color) &&
        !isCheck(boardContent, { y: position.y, x: position.x - 2 }, color)
      )
        possibleMoves.push({
          y: position.y,
          x: position.x - 2,
          type: "move",
        });
    }

    if (boardContent[position.y][7].castling) {
      let squaresClear = true;
      for (let x = position.x + 1; x < 7 && squaresClear; x++)
        squaresClear = !boardContent[position.y][x].piece;

      if (
        squaresClear &&
        !isCheck(boardContent, { y: position.y, x: position.x + 1 }, color) &&
        !isCheck(boardContent, { y: position.y, x: position.x + 2 }, color)
      )
        possibleMoves.push({
          y: position.y,
          x: position.x + 2,
          type: "move",
        });
    }
  }

  return possibleMoves.filter(
    (move) => !isCheckOnMove(boardContent, position, { y: move.y, x: move.x }, color)
  );
};

module.exports = PiecesMoves;
