Generator website to add pegs to any STL model so it can be mounted on a Målområde peg board.

Målområde looks like a Skadis board but the layout is slightly different.
Skadis is 20x20mm grid, but Målområde is 20x21.5mm. So models made for Skadis might not fit.

This is a fork of a Skadis generator, but you can modify the grid size. You can create a grid perfect for Målområde along with pegs that can fit the 1mm thick peg board of the Målområde board.

Use only the "Normal" pegs. I only added one peg model so only the "Normal" will fit.

### Example of IKEA Målområde annoying new layout:

Here is an example of how Målområde grid looks like, so you are sure the result will fit:

X = Hole

<img width="252" height="211" alt="image" src="https://github.com/user-attachments/assets/2f276164-5031-4e9f-83d0-bd1d4be59d99" />


Distance between each hole in the same row = 40mm
Distance between row 1 and row 2 = 21.5mm
Distance between between row 1 and row 3 = 42.5mm
Row 1 and row 2 are offset by 20mm


### How to run:

Have Python installed and run this command in cmd in the folder with all files: python -m http.server 8000

Use a different port number (8000) if you already have the port in use.

Go to http://localhost:8000/


### Disclaimer:

This was quickly thrown together and committed in case anybody else needs it. Do not expect any support or bug fixes. PRs are welcome.
