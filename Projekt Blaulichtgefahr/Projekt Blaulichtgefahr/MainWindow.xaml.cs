using Microsoft.Win32;
using System;
using System.Diagnostics;
using System.Printing.IndexedProperties;
using System.Windows;
using System.Security.Principal;
using System.Globalization;
using Projekt_Blaulichtgefahr.View;
using System.Data;
using System.IO;
using System.Windows.Controls.Primitives;
using System.Linq;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Collections.ObjectModel;
using System.Net.WebSockets;
using System.Data.SqlClient;
using System.Threading;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Security.Cryptography.X509Certificates;
using System.Windows.Media;
using System.Windows.Controls.Ribbon;

namespace Projekt_Blaulichtgefahr
{
    public partial class MainWindow : Window, INotifyPropertyChanged
    {
        public MainWindow()
        {
            InitializeComponent();
            
        }

        public event PropertyChangedEventHandler? PropertyChanged;
        int TypV { get; set; }
        double Länge { get; set; }
        bool Check1 { get; set; }   
        bool Check2 { get; set; } 



        public void btnEnterDV_Click(object sender, RoutedEventArgs e)
        {
            Dialog inputDialog = new Dialog();
            if (inputDialog.ShowDialog() == true) 
            {
                TypV = Convert.ToInt32(inputDialog.Answer1);
                Länge = Convert.ToDouble(inputDialog.Answer2);
                Check1 = Convert.ToBoolean(inputDialog.CheckboxStatus1);
                Check2 = Convert.ToBoolean(inputDialog.CheckboxStatus2);
                string bez;
                if (Check1 == true)
                {
                    bez = "Radius: ";
                }
                else
                {
                    bez = "Kantenlänge: ";
                }
                TypMax.Text = "Typischer Lichtstrom: " + TypV.ToString() + " lm" + "\n" + bez + Länge.ToString() + " mm";
                DataView dv = new DataView(null); 
                dtGridView.ItemsSource = dv;
                return;
            }
        }

        public void CSV_Eingabe_Click(object sender, RoutedEventArgs e)
        {
            
            OpenFileDialog fileDialog = new OpenFileDialog();
            fileDialog.Filter = "CSV Dateien | *.csv";
            //Get Username
            string User_full = WindowsIdentity.GetCurrent().Name;
            string User = User_full.Substring(User_full.IndexOf('\\') + 1);
            //Set Initial to Downloads Folder
            fileDialog.InitialDirectory = "C:\\Users\\" + User + "\\Downloads";
            fileDialog.ShowDialog();
            if (fileDialog.FileName != "")
            {
                string filepath = fileDialog.FileName;
                ImportCSV_and_Calc(filepath);
            }
            else
            { }
        }

        
        public void ImportCSV_and_Calc(string path)
        {
            CSV_Import csv = new CSV_Import();
            string[] CsvArray;

            DataTable dt = new DataTable();
            dt.Columns.Add("Wellenlänge", typeof(int));
            dt.Columns.Add("Φe rel", typeof(string));
            dt.Columns.Add("lm", typeof(int));

            dt.Columns.Add("V(λ)", typeof(string));
            dt.Columns.Add("abc", typeof(string));
            dt.Columns.Add("A", typeof(string));
            dt.Columns.Add("Φe korrekt", typeof(string));
            if (Länge < 2.2)
            {
                dt.Columns.Add("E(λ)", typeof(string));
                dt.Columns.Add("EB(λ)", typeof(string));
            }
            else
            {
                dt.Columns.Add("L(λ)", typeof(string));
                dt.Columns.Add("LB(λ)", typeof(string));
            }
            
            dt.Columns.Add("B(λ)", typeof(string));
            dt.Columns.Add("LEgesamt", typeof(string));
            dt.Columns.Add("Risikogruppe", typeof(string));
            dt.Columns.Add("Maximalzeit", typeof(string));
            int lm = 683;
            
            using StreamReader sr = new StreamReader(path);
            {
                while (!sr.EndOfStream)
                {
                    CsvArray = sr.ReadLine().Split(";");
                    csv.Wellenlänge = Convert.ToInt32(CsvArray[0]);
                    csv.RRP_Prozent = Convert.ToDouble(CsvArray[1]);
                    dt.Rows.Add(CsvArray);
                }
            }

            string Firstline = dt.Rows[0][0].ToString();
            string Lastline = dt.Rows[dt.Rows.Count - 1][0].ToString();
            Wellenlänge_block.Text = "Kleinste Wellenlänge: " + Firstline + "\n" + "Größte Wellenlänge: " + Lastline;

            //add lm
            foreach (DataRow dr in dt.Rows)
            {
                dr["lm"] = lm;
            }
            //add vlambda
            string svSQL = "SELECT * FROM Vlambda_Werte1 Where [Wellenlänge] BETWEEN'"+ Firstline +"' AND '"+ Lastline +"'";
            DataTable sqlv = DB.Get_DataTable(svSQL);
            string sbSQL = "SELECT * FROM Blambda_Werte1 Where [Wellenlänge] BETWEEN'" + Firstline + "' AND '" + Lastline + "'";
            DataTable sqlb = DB.Get_DataTable(sbSQL);

            int i = 0;
            foreach (DataRow dr in dt.Rows)
            {                
                dr["V(λ)"] = sqlv.Rows[i][2];
                dr["B(λ)"] = sqlb.Rows[i][2];
                i++;
            }

            //calc DV rel   dt.Rows[Row][Column]  Column 0 Wllänge, 1 RPP, 2 683, 3 vlambda , 4 phi e korrekt,         
            /*(double p = 0;
            int o = 0;
            foreach (DataRow dr in dt.Rows)
            {
                p = Convert.ToDouble(dt.Rows[o]["Φe rel"]) * Convert.ToInt16(dt.Rows[o]["lm"]) * Convert.ToDouble(dt.Rows[o]["V(λ)"]);
                dr["abc"] = String.Format("{0:0.0000000}", p);
                o++;
            }
            */
            double p = 0;
            int o = 0;

            foreach (DataRow dr in dt.Rows)
            {
                double phiRel = 0;
                double vLambda = 0;
                int lm1 = 0;

                // Überprüfen, ob die Werte korrekt gelesen werden können
                if (double.TryParse(dt.Rows[o]["Φe rel"].ToString(), out phiRel) &&
                    int.TryParse(dt.Rows[o]["lm"].ToString(), out lm1) &&
                    double.TryParse(dt.Rows[o]["V(λ)"].ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out vLambda))
                {
                    // Werte korrekt gelesen
                    p = phiRel * lm * vLambda;
                    dr["abc"] = p.ToString("0.0000000", CultureInfo.InvariantCulture);
                }
                else
                {
                    throw new ArgumentException("Error1");
                    // Fehler beim Lesen der Werte
                    // Fügen Sie hier ggf. Fehlerbehandlung oder -protokollierung hinzu
                }

                o++;
            }
            int j = dt.Rows.Count - 1;
            double agg = 0;

            while (j >= 0)
            {
                double abcValue = 0;
                if (double.TryParse(dt.Rows[j]["abc"].ToString(), NumberStyles.Float, CultureInfo.InvariantCulture, out abcValue))
                {
                    agg += abcValue;
                }
                else
                {
                    throw new ArgumentException("Error2");
                    // Fehler beim Lesen des Werts
                    // Fügen Sie hier ggf. Fehlerbehandlung oder -protokollierung hinzu
                }

                j--;
            }

            /*
            int j = dt.Rows.Count - 1;
            double agg = 0;
            while (j >= 0 )
            {
                agg = agg + Convert.ToDouble(dt.Rows[j]["abc"]);        
                j--;
            }
            */
            //add A
            double aval = TypV / agg;
            dt.Rows[0]["A"] = String.Format("{0:0.000000}", aval);

            A_Value.Text = "A_Wert: " + String.Format("{0:0.000000}", aval);
            Agg_Value.Text = "Φv rel - lm: " + String.Format("{0:0.000000}", agg);
            //calc add DV korrekt
            int k = 0;
            
            double r2 = 0.001 * Länge;

            if (Länge > 2.2)
            {
                /*
                foreach (DataRow dr in dt.Rows)
                {
                    r = Convert.ToDouble(dt.Rows[k][1]) * aval;
                    dr["Φe korrekt"] = String.Format("{0:0.0000000}", r);
                    r = (double)Convert.ToDouble(dt.Rows[k]["Φe korrekt"]) / (r2 * r2 * 3.14159265359);
                    dr["L(λ)"] = String.Format("{0:0.0000000}", r);
                    r = Convert.ToDouble(dt.Rows[k]["L(λ)"]) * Convert.ToDouble(dt.Rows[k]["B(λ)"]);
                    dr["LB(λ)"] = String.Format("{0:0.0000000}", r);
                    k++;
                }
                int j2 = dt.Rows.Count - 1;
                double agg2 = 0;
                while (j2 >= 0)
                {
                    agg2 += Convert.ToDouble(dt.Rows[j2]["LB(λ)"]);
                    j2--;
                }*/

                double check = 0;
                if (Check1 == true && Check2 == false)
                {
                    check = 3.14159265359;
                }
                else if (Check2 == true && Check1 == false)
                {
                    check = 1;
                }
                else
                {
                    MessageBox.Show("Checkbox nicht ausgefüllt oder beide angehakt." + "\n" + "Hierbei bitte nur eine Checkbox wählen");
                    return;
                }

                foreach (DataRow dr in dt.Rows)
                {
                    double r = Convert.ToDouble(dt.Rows[k][1]) * aval;
                    dr["Φe korrekt"] = r.ToString("0.0000000");
                    
                    r = Convert.ToDouble(dr["Φe korrekt"]) / (r2 * r2 * 3.14159265359 * check);
                    dr["L(λ)"] = r.ToString("0.0000000");

                    r = Convert.ToDouble(dr["L(λ)"]) * Convert.ToDouble(dt.Rows[k]["B(λ)"]);
                    dr["LB(λ)"] = r.ToString("0.0000000");

                    k++;
                }

                int j2 = dt.Rows.Count - 1;
                double agg2 = 0;
                while (j2 >= 0)
                {
                    string lbValueString = dt.Rows[j2]["LB(λ)"].ToString().Replace(',', '.');
                    agg2 += Convert.ToDouble(lbValueString, CultureInfo.InvariantCulture);

                    j2--;
                }

                dt.Rows[0]["LEgesamt"] = String.Format("{0:0.000000}", agg2);

                string risk;
                if (agg2 < 100)
                {
                    risk = "Freie Gruppe (Risikofrei)";
                    Zeit.Background = Brushes.Green;
                }
                else
                {
                    if (agg2 < 10000)
                    {
                        risk = "Gruppe 1 (Geringes Risiko)";
                        Zeit.Background = Brushes.Yellow;
                    }
                    else
                    {
                        if (agg2 < 4000000)
                        {
                            risk = "Gruppe 2 (Mittleres Risiko)";
                            Zeit.Background = Brushes.Red;
                        }
                        else
                        {
                            risk = "Gruppe 3 (Hohes Risiko)";
                            Zeit.Background = Brushes.Purple;
                    }
                    }
                }

                dt.Rows[0]["Risikogruppe"] = risk;
                double maxtime = (double)1000000 / agg2;
                dt.Rows[0]["Maximalzeit"] = String.Format("{0:0.000000}", maxtime);
                Zeit.Text = "Zeit vor photochemischer Schädigung: " + "\n" + String.Format("{0:0.000}", maxtime) + " Sekunden" + "\n\n" + "Risikogruppe nach DIN 62471: " + "\n" + risk; ;
            }
            else
            {
                foreach (DataRow dr in dt.Rows)
                {
                    double r = Convert.ToDouble(dt.Rows[k][1]) * aval;
                    dr["Φe korrekt"] = String.Format("{0:0.0000000}", r);
                    r = (double)Convert.ToDouble(dt.Rows[k]["Φe korrekt"]) / (0.2 * 0.2 * 3.14159265359);
                    dr["E(λ)"] = String.Format("{0:0.0000000}", r);
                    r = Convert.ToDouble(dt.Rows[k]["E(λ)"]) * Convert.ToDouble(dt.Rows[k]["B(λ)"]);
                    dr["EB(λ)"] = String.Format("{0:0.0000000}", r);
                    k++;
                }
                int j2 = dt.Rows.Count - 1;
                double agg2 = 0;
                while (j2 >= 0)
                {
                    agg2 += Convert.ToDouble(dt.Rows[j2]["EB(λ)"]);
                    j2--;
                }
                dt.Rows[0]["LEgesamt"] = String.Format("{0:0.000000}", agg2);
                
                string risk;
                if (agg2 < 0.5)
                {
                    risk = "Freie Gruppe (Risikofrei)";
                    Zeit.Background = Brushes.Green;
                }
                else
                {
                    if(agg2 < 1)
                    {
                        risk = "Gruppe 1 (Geringes Risiko)";
                        Zeit.Background = Brushes.Yellow;
                    }
                    else
                    {
                        if (agg2 < 400)
                        {
                            risk = "Gruppe 2 (Mittleres Risiko)";
                            Zeit.Background = Brushes.Red;
                        }
                        else
                        {
                            risk = "Gruppe 3 (Hohes Risiko)";
                            Zeit.Background = Brushes.Purple;
                        }
                    }
                }

                dt.Rows[0]["Risikogruppe"] = risk;
                double maxtime = (double)100 / agg2;
                dt.Rows[0]["Maximalzeit"] = String.Format("{0:0.000000}", maxtime);
                Zeit.Text = "Zeit vor photochemischer Schädigung: " + "\n" + String.Format("{0:0.000}", maxtime) + " Sekunden " + "\n\n" + "Risikogruppe nach DIN 62471: " + "\n" + risk;
                
                
            }

            DataView dv = new DataView(dt);
            dtGridView.ItemsSource = dv;
        }

        /*
        //Import the V(λ) und B(λ) Values to Database
        public void ImportCSV2()
        {
            CSV_Import2 csv2 = new CSV_Import2();
            string[] CsvArray2;

            DataTable dt2 = new DataTable();
            dt2.Columns.Add("Wellenlänge", typeof(int));
            dt2.Columns.Add("VLambda", typeof(double));
            string path = "C:\\Users\\fbfel\\OneDrive\\Desktop\\Blambda.csv";

            using StreamReader sr = new StreamReader(path);
            {
                while (!sr.EndOfStream)
                {
                    CsvArray2 = sr.ReadLine().Split(";");
                    csv2.Wellenlänge = Convert.ToInt32(CsvArray2[0]);
                    csv2.Vlambda = Convert.ToDouble(CsvArray2[1]);
                    dt2.Rows.Add(CsvArray2);
                    string wel = CsvArray2[0];
                    string bl = CsvArray2[1];
                    string sql_add = "INSERT INTO Blambda_Werte1 ([Wellenlänge],[Blambda]) VALUES('" + wel + "', '" + bl + "')";                    
                    DB.Execute_SQL(sql_add);                   
                    
                }
            } 
        }*/
        
    }
}
