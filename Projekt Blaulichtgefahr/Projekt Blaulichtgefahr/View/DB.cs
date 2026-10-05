using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Data.SqlClient;   
using System.Data;
using System.Data.Common;
using System.Windows.Markup;

namespace Projekt_Blaulichtgefahr.View
{
    public static class DB
    {
        
        public static SqlConnection Get_DB_Connection()

        {

            //--------< db_Get_Connection() >--------

            //< db oeffnen >
            //string cn_String = "Data Source = (LocalDB)\\MSSQLLocalDB;AttachDbFilename=" + System.IO.Path.GetFullPath("Downloads\\Blaulicht\\Database1.mdf") + "; Integrated Security=True";
            string cn_String = Settings.Default.Datenbank_Verbindung;
            SqlConnection.ClearAllPools();
            SqlConnection cn_connection = new SqlConnection(cn_String);
            
            if (cn_connection.State != ConnectionState.Open) cn_connection.Open();
            //</ db oeffnen >

            //< output >
            return cn_connection;
            //</ output >

            //--------</ db_Get_Connection() >--------

        }

        public static DataTable Get_DataTable(string SQL_Text)

        {
            //--------< db_Get_DataTable() >--------
            SqlConnection cn_connection = Get_DB_Connection();
            
            //< get Table >
            DataTable table = new DataTable();
            SqlDataAdapter adapter = new SqlDataAdapter(SQL_Text, cn_connection);
            adapter.Fill(table);
            //</ get Table >

            //< output >
            return table;
            //</ output >
            //--------</ db_Get_DataTable() >--------
        }

        public static void Execute_SQL(string SQL_Text)

        {
            //--------< Execute_SQL() >--------
            SqlConnection cn_connection = Get_DB_Connection();

            //< get Table >
            SqlCommand cmd_Command = new SqlCommand(SQL_Text, cn_connection);
            
            cmd_Command.ExecuteNonQuery();
            //</ get Table >
            //--------</ Execute_SQL() >--------
        }

        public static void Close_DB_Connection()

        {

            //--------< Close_DB_Connection() >--------
            //< db oeffnen >
            string cn_String = Settings.Default.Datenbank_Verbindung;
            SqlConnection cn_connection = new SqlConnection(cn_String);
            if (cn_connection.State != ConnectionState.Closed) cn_connection.Close();
            //</ db oeffnen >
            //--------</ Close_DB_Connection() >--------

        }
    }
}
